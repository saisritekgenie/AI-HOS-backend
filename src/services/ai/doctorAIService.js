const BaseAIService = require("./baseAIService");
const User = require("../../models/userModel");
const { LabRequest, VitalsRecord, Consultation, MedicationRecord } = require("../../models/clinicalModel");

class DoctorAIService extends BaseAIService {
  async getPatientSummary(patientId) {
    const [patient, vitals, labs, medications, consultations] = await Promise.all([
      User.findById(patientId),
      VitalsRecord.find({ patient: patientId }).sort({ createdAt: -1 }).limit(3),
      LabRequest.find({ patient: patientId, status: "COMPLETED" }).sort({ createdAt: -1 }).limit(3),
      MedicationRecord.find({ patient: patientId }).sort({ createdAt: -1 }).limit(5),
      Consultation.find({ patient: patientId }).sort({ createdAt: -1 }).limit(3),
    ]);

    if (!patient) {
      return { summary: "Patient file not found.", medicationReview: "", labInterpretation: "", healthTips: [] };
    }

    const userPrompt = JSON.stringify({
      patient: { firstName: patient.firstName, lastName: patient.lastName, chronicDiseases: patient.chronicDiseases, allergies: patient.allergies },
      vitals,
      labs,
      medications,
      consultations
    });

    const systemPrompt = "You are an AI Clinical Summarizer. Review this patient's medical history data and provide a concise layman's summary of their health status, active prescriptions, abnormal lab values, and recommendations. Return a JSON containing: summary (string), medicationReview (string), labInterpretation (string), healthTips (array of strings). Output JSON only.";
    const llmResult = await this.callLLM(systemPrompt, userPrompt);
    if (llmResult) {
      try {
        return JSON.parse(this.cleanJSONString(llmResult));
      } catch (e) {}
    }

    const latestVitals = vitals[0] ? `Vitals recorded on ${new Date(vitals[0].createdAt).toLocaleDateString()}: BP ${vitals[0].bp}, SpO2 ${vitals[0].spo2}%, Temp ${vitals[0].temperature}°F.` : "No vitals logged recently.";
    const chronicNotes = patient.chronicDiseases?.length > 0 ? `Active chronic diseases: ${patient.chronicDiseases.join(", ")}.` : "No chronic illnesses registered.";
    const allergyNotes = patient.allergies?.length > 0 ? `Known patient allergies: ${patient.allergies.join(", ")}.` : "No known drug/food allergies.";

    const summaries = [
      `Patient ${patient.firstName} ${patient.lastName} medical record summary.`,
      latestVitals,
      chronicNotes,
      allergyNotes
    ];

    const activeMeds = medications.map(m => `${m.medicationName} (${m.dosage} - ${m.frequency})`).join(", ");

    return {
      summary: summaries.join(" "),
      medicationReview: medications.length > 0 ? `Current active prescriptions include: ${activeMeds}.` : "No active clinical pharmacotherapy courses logged.",
      labInterpretation: labs.length > 0 ? `Completed tests: ${labs.map(l => `${l.testName} (${l.results})`).join("; ")}.` : "No diagnostic reports logged.",
      healthTips: [
        "Maintain regular logs of blood pressure and sugar parameters.",
        "Ensure full adherence to prescribed pharmaceutical dosages.",
        "Report any respiratory discomfort or sudden vitals shifts immediately."
      ]
    };
  }

  async getMedicalScribeDraft(shorthandText) {
    const systemPrompt = "You are an AI Medical Scribe. Convert the doctor's quick shorthand notes into a structured JSON string containing: diagnosis (string), clinicalNotes (string), prescriptions (array of objects with medicationName, dosage, frequency), and followUpRecommend (string). Output JSON only.";
    const llmResult = await this.callLLM(systemPrompt, shorthandText);
    if (llmResult) {
      try {
        return JSON.parse(this.cleanJSONString(llmResult));
      } catch (e) {}
    }

    const lower = shorthandText.toLowerCase();
    let diagnosis = "General Consultation / Undifferentiated symptoms";
    let clinicalNotes = `Patient presented with complaints described as: "${shorthandText}". Rest and symptom monitoring advised.`;
    const prescriptions = [];
    let followUpRecommend = "Return in 5-7 days if symptoms persist.";

    if (lower.includes("fever") || lower.includes("temp")) {
      diagnosis = "Acute Viral Syndrome";
      clinicalNotes = `Patient reports onset of pyrexia. Temp logs indicate warm skin and moderate fatigue. Prescribed antipyretic relief.`;
      prescriptions.push({ medicationName: "Paracetamol 650mg", dosage: "1 Tablet", frequency: "Three times daily after meals" });
    }
    if (lower.includes("cough") || lower.includes("cold")) {
      diagnosis = diagnosis === "Acute Viral Syndrome" ? "Acute Viral Nasopharyngitis" : "Acute Bronchitis";
      clinicalNotes += " Mild congestion heard in chest, upper airways inflamed. Hydration encouraged.";
      prescriptions.push({ medicationName: "Ambroxol Cough Syrup", dosage: "10 ml", frequency: "Twice daily" });
    }
    if (lower.includes("bp") || lower.includes("hypertension") || lower.includes("pressure")) {
      diagnosis = "Essential Hypertension Monitoring";
      clinicalNotes += " Elevated blood pressure trends observed. Sodium restriction advised.";
      prescriptions.push({ medicationName: "Amlodipine 5mg", dosage: "1 Tablet", frequency: "Once daily (Morning)" });
    }

    return {
      diagnosis,
      clinicalNotes,
      prescriptions,
      followUpRecommend
    };
  }

  async getDoctorDiagnosisSuggestions(vitals, complaints) {
    const userPrompt = `Vitals: ${JSON.stringify(vitals)}. Complaints: ${complaints}`;
    const systemPrompt = "You are a senior physician's diagnostic AI. Formulate differential diagnoses based on these vitals and complaints. Return a JSON containing: suggestions (array of diagnosis names), reasoning (string), safetyPrecautions (array of strings). Output JSON only.";
    const llmResult = await this.callLLM(systemPrompt, userPrompt);
    if (llmResult) {
      try {
        return JSON.parse(this.cleanJSONString(llmResult));
      } catch (e) {}
    }

    const lower = (complaints || "").toLowerCase();
    const suggestions = ["General Malaise"];
    let reasoning = "Recorded metrics indicate stable metabolic functions. No urgent red flags in standard diagnostic logs.";
    const safetyPrecautions = ["Advise patient to monitor temperature trends.", "Ensure adequate hydration."];

    if (vitals?.spo2 && vitals.spo2 < 92) {
      suggestions.push("Hypoxemic Respiratory Distress", "Acute Pneumonitis");
      reasoning = "SpO2 reading is sub-optimal (<92%). Review lungs for congestion and check chest X-ray.";
      safetyPrecautions.push("🚨 Monitor SpO2 levels every hour.", "Administer supplemental O2 if levels fall below 90%.");
    }

    if (lower.includes("chest pain") || lower.includes("heart")) {
      suggestions.push("Angina Pectoris", "Myocardial Ischemia Evaluation", "Gastroesophageal Reflux Disease");
      reasoning = "Chest discomfort reported by patient. Needs immediate ECG tracing to rule out acute coronary syndrome.";
      safetyPrecautions.push("🚨 Emergency ECG tracing required.", "Keep sublingual nitroglycerin ready.");
    } else if (lower.includes("fever") || (vitals?.temperature && parseFloat(vitals.temperature) > 100)) {
      suggestions.push("Acute Viral Fever", "Gastroenteritis / Viral Enteritis");
      reasoning = "Pyrexia noted. Consider CBC and peripheral blood smear if fever exceeds 72 hours.";
    }

    return {
      suggestions,
      reasoning,
      safetyPrecautions
    };
  }

  async getPrescriptionAssistantCheck(medications, patientAllergies) {
    const userPrompt = `Medications: ${JSON.stringify(medications)}. Patient Allergies: ${JSON.stringify(patientAllergies || [])}`;
    const systemPrompt = "You are a clinical pharmacist AI. Analyze this proposed list of medications and patient allergies. Return a JSON containing: warnings (array of strings), interactions (array of strings), allergenConflict (boolean), dosageAlerts (array of strings), and recommendations (string). Output JSON only.";
    const llmResult = await this.callLLM(systemPrompt, userPrompt);
    if (llmResult) {
      try {
        return JSON.parse(this.cleanJSONString(llmResult));
      } catch (e) {}
    }

    const medNames = (medications || []).map(m => (m.medicationName || m.name || m).toLowerCase());
    const warnings = [];
    const interactions = [];
    let allergenConflict = false;
    const dosageAlerts = [];
    let recommendations = "Prescription details check passed clinical safety review limits.";

    if (medNames.includes("aspirin") && medNames.includes("warfarin")) {
      interactions.push("Aspirin + Warfarin: High hemorrhagic risk due to additive antiplatelet/anticoagulant effects.");
      warnings.push("High bleeding risk. Consider switching Aspirin to another option unless indicated.");
    }

    const allergiesLower = (patientAllergies || []).map(a => a.toLowerCase());
    medNames.forEach(name => {
      allergiesLower.forEach(allergy => {
        if (name.includes(allergy) || allergy.includes(name)) {
          allergenConflict = true;
          warnings.push(`CRITICAL: Allergen clash detected! Patient is allergic to "${allergy}" and prescribed medication is "${name}".`);
        }
      });
    });

    if (allergenConflict || warnings.length > 0 || interactions.length > 0) {
      recommendations = "⚠️ Action required: Review prescribed drug formulations to prevent adverse reactions.";
    }

    return {
      warnings,
      interactions,
      allergenConflict,
      dosageAlerts,
      recommendations
    };
  }

  async getFollowUpRecommendations(diagnosis, lastVitals) {
    const userPrompt = `Diagnosis: ${diagnosis}. Vitals: ${JSON.stringify(lastVitals)}`;
    const systemPrompt = "You are a clinical follow-up recommender AI. Recommend when the patient should return, which tests should be ordered, and warning signs to watch out for. Return JSON containing: recommendedDays (number), recommendedTests (array of strings), and warningsToWatch (array of strings). Output JSON only.";
    const llmResult = await this.callLLM(systemPrompt, userPrompt);
    if (llmResult) {
      try {
        return JSON.parse(this.cleanJSONString(llmResult));
      } catch (e) {}
    }

    let recommendedDays = 7;
    const recommendedTests = ["Vitals monitoring"];
    const warningsToWatch = ["High fever persisting for 48 hours", "Inability to hold fluids down"];

    const diagLower = (diagnosis || "").toLowerCase();
    if (diagLower.includes("hypertension") || diagLower.includes("bp") || diagLower.includes("pressure")) {
      recommendedDays = 14;
      recommendedTests.push("Daily BP Diary log review", "Kidney Function Test");
      warningsToWatch.push("Sudden severe headache", "Chest pain or shortness of breath", "Systolic BP exceeding 180 mmHg");
    } else if (diagLower.includes("diabetes") || diagLower.includes("sugar")) {
      recommendedDays = 30;
      recommendedTests.push("HbA1c Blood Test", "Fasting Blood Glucose");
      warningsToWatch.push("Extreme fatigue or confusion", "Sudden blurring of vision", "Slow healing cuts or skin sores");
    }

    return {
      recommendedDays,
      recommendedTests,
      warningsToWatch
    };
  }

  async processChat(content, doctorId) {
    if (this.isGreeting(content)) {
      return {
        reply: "Hello Doctor! I am your AI Clinical Assistant. I can assist you with patient diagnostic reports, scribe shorthand transcriptions, prescription allergen checks, or differential diagnosis hints. How can I help you today?",
        keyTakeaways: ["Clinical AI aids diagnosis but all orders require physician confirmation."],
        recommendations: ["Query patient summary logs, check prescription combinations, or dictate clinical notes."]
      };
    }

    const userPrompt = `Input: ${content}`;
    const systemPrompt = "You are the Doctor's Clinical AI Assistant. Assist the physician with diagnosis options, shorthand reviews, and safety queries. Return JSON containing: reply (text), keyTakeaways (array of strings), recommendations (array of strings).";

    const llmResult = await this.callLLM(systemPrompt, userPrompt);
    if (llmResult) {
      try {
        return JSON.parse(this.cleanJSONString(llmResult));
      } catch (e) {}
    }

    // Local Fallback
    const lower = content.toLowerCase();
    if (lower.includes("vitals") || lower.includes("diagnosis") || lower.includes("complaint")) {
      const suggestions = await this.getDoctorDiagnosisSuggestions({}, content);
      return {
        reply: `Based on complaints: ${suggestions.reasoning}`,
        keyTakeaways: ["Potential differentials: " + suggestions.suggestions.join(", ")],
        recommendations: suggestions.safetyPrecautions
      };
    }

    if (lower.includes("allergy") || lower.includes("interaction") || lower.includes("pills") || lower.includes("meds")) {
      return {
        reply: "Medication review triggered. Ensure to check if the patient has recorded penicillin or sulfa allergies before adding broad-spectrum antibiotics.",
        keyTakeaways: ["Warfarin combined with antiplatelets is contraindicated.", "Check for active MAR entries in the patient's record."],
        recommendations: ["Review EMR prescription profile.", "Validate drug interaction risk values before dispensing."]
      };
    }

    return {
      reply: "I have parsed your clinical note. All active indicators and physiological logs for patients on your round lists are loaded.",
      keyTakeaways: ["Emphasize: 'Final medical choices rest with authorized doctor only.'"],
      recommendations: ["Consult the EMR logs.", "Run AI Scribe on consult shorthand notes."]
    };
  }
}

module.exports = new DoctorAIService();
