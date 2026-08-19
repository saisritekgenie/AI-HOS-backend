class BaseAIService {
  /**
   * Helper to scrub PHI from text prompts (emails, phone numbers)
   * @param {string} text - Raw input prompt text
   * @returns {string} - Clean scrubbed prompt text
   */
  scrubPrompt(text) {
    if (!text || typeof text !== "string") return text;

    let scrubbed = text;
    // Mask email addresses
    scrubbed = scrubbed.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[EMAIL_MASKED]");
    // Mask 10-digit phone numbers
    scrubbed = scrubbed.replace(/\b\d{10}\b/g, "[MOBILE_MASKED]");
    
    return scrubbed;
  }

  /**
   * Helper to scrub specific patient name references from prompts
   * @param {string} text - Raw input prompt text
   * @param {object} patient - Patient profile containing firstName and lastName
   * @returns {string} - Clean scrubbed prompt text
   */
  scrubPatientData(text, patient) {
    if (!text || typeof text !== "string") return text;
    
    let scrubbed = this.scrubPrompt(text);
    if (patient) {
      if (patient.firstName) {
        const regex = new RegExp(patient.firstName, "gi");
        scrubbed = scrubbed.replace(regex, "[PATIENT_FIRST_NAME]");
      }
      if (patient.lastName) {
        const regex = new RegExp(patient.lastName, "gi");
        scrubbed = scrubbed.replace(regex, "[PATIENT_LAST_NAME]");
      }
    }
    return scrubbed;
  }

  /**
   * Helper to perform actual LLM API call if keys are present
   */
  async callLLM(systemPrompt, userPrompt) {
    // Audit & Scrub PHI before sending external requests
    const cleanSystemPrompt = this.scrubPrompt(systemPrompt);
    const cleanUserPrompt = this.scrubPrompt(userPrompt);

    const geminiKey = process.env.GEMINI_API_KEY;
    const openAIKey = process.env.OPENAI_API_KEY;

    if (geminiKey) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: `${cleanSystemPrompt}\n\nUser Input Context:\n${cleanUserPrompt}` }]
            }]
          })
        });
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      } catch (err) {
        console.error("Gemini API call failed, falling back to local simulation:", err);
      }
    }

    if (openAIKey) {
      try {
        const url = "https://api.openai.com/v1/chat/completions";
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openAIKey}`
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: cleanSystemPrompt },
              { role: "user", content: cleanUserPrompt }
            ]
          })
        });
        const data = await response.json();
        return data.choices?.[0]?.message?.content || "";
      } catch (err) {
        console.error("OpenAI API call failed, falling back to local simulation:", err);
      }
    }

    return null; // Return null to trigger local fallback logic
  }

  /**
   * Helper to parse JSON output cleanly from LLM
   */
  cleanJSONString(str) {
    if (!str) return null;
    return str
      .replace(/```json/gi, "")
      .replace(/```/gi, "")
      .trim();
  }

  /**
   * Helper to check if context message is a greeting
   */
  isGreeting(content) {
    const cleanContent = (content || "").trim().toLowerCase();
    const greetings = ["hi", "hello", "hey", "greetings", "good morning", "good afternoon", "good evening", "howdy", "hola", "yo"];
    return greetings.includes(cleanContent) || cleanContent.match(/^(hi|hello|hey|yo)[\s.!?]*$/i);
  }

  /**
   * Retrieve structured live hospital data from the database scoped by hospitalId
   */
  async getHospitalDatabaseContext(hospitalId, queryText = "") {
    if (!hospitalId) return "No hospital ID provided. No database context available.";

    // Load models dynamically to prevent circular dependency
    const User = require("../../models/userModel");
    const Hospital = require("../../models/hospitalModel");
    const { Appointment, AdmissionRecord, Invoice } = require("../../models/receptionModel");
    const { VitalsRecord, LabRequest, Consultation, MedicationRecord } = require("../../models/clinicalModel");
    const { BillingInvoice } = require("../../models/billingModel");
    const { Medicine } = require("../../models/pharmacyModel");

    try {
      const hospital = await Hospital.findById(hospitalId);
      const hospitalName = hospital ? hospital.name : "KIMS Hospital";

      // 1. Fetch all users for this hospital (to decrypt in memory)
      const allUsers = await User.find({ hospital: hospitalId });
      const staffList = allUsers.filter(u => u.role !== "PATIENT");
      const patientList = allUsers.filter(u => u.role === "PATIENT");

      // Check if user is asking about a specific patient
      const lowerQuery = queryText.toLowerCase();
      let targetedPatients = [];
      
      // Look for patient name matches in the query
      for (const p of patientList) {
        const first = (p.firstName || "").toLowerCase();
        const last = (p.lastName || "").toLowerCase();
        if ((first && lowerQuery.includes(first)) || 
            (last && lowerQuery.includes(last)) || 
            (p.uhid && lowerQuery.includes(p.uhid.toLowerCase())) || 
            (p.patientId && lowerQuery.includes(p.patientId.toLowerCase()))) {
          targetedPatients.push(p);
        }
      }

      // If we found targeted patients, filter clinical and billing records to those patients.
      // Otherwise, get all patients.
      const hasTargetPatients = targetedPatients.length > 0;
      const patientFilterIds = hasTargetPatients ? targetedPatients.map(p => p._id) : patientList.map(p => p._id);

      // 2. Fetch other related collections in parallel
      const [appointments, admissions, vitals, labs, medications, consultations, invoices, billingInvoices, medicines] = await Promise.all([
        Appointment.find({ hospital: hospitalId }).populate("patient", "firstName lastName").populate("doctor", "firstName lastName"),
        AdmissionRecord.find({ hospital: hospitalId }).populate("patient", "firstName lastName"),
        VitalsRecord.find({ hospital: hospitalId, patient: { $in: patientFilterIds } }).populate("patient", "firstName lastName").sort({ createdAt: -1 }).limit(hasTargetPatients ? 15 : 10),
        LabRequest.find({ hospital: hospitalId, patient: { $in: patientFilterIds } }).populate("patient", "firstName lastName").populate("prescribedBy", "firstName lastName").sort({ createdAt: -1 }).limit(hasTargetPatients ? 15 : 10),
        MedicationRecord.find({ hospital: hospitalId, patient: { $in: patientFilterIds } }).populate("patient", "firstName lastName").populate("prescribedBy", "firstName lastName").sort({ createdAt: -1 }).limit(hasTargetPatients ? 15 : 10),
        Consultation.find({ hospital: hospitalId, patient: { $in: patientFilterIds } }).populate("patient", "firstName lastName").populate("doctor", "firstName lastName").sort({ createdAt: -1 }).limit(hasTargetPatients ? 15 : 10),
        Invoice.find({ hospital: hospitalId, patient: { $in: patientFilterIds } }).populate("patient", "firstName lastName").sort({ createdAt: -1 }).limit(10),
        BillingInvoice.find({ hospital: hospitalId, patient: { $in: patientFilterIds } }).populate("patient", "firstName lastName").sort({ createdAt: -1 }).limit(10),
        Medicine.find({ hospital: hospitalId }).limit(20)
      ]);

      // Format patient list (limiting to 20 or targeted ones to avoid token bloat)
      const displayedPatients = hasTargetPatients ? targetedPatients : patientList.slice(0, 15);
      const patientSummary = displayedPatients.map(p => 
        `- Name: ${p.firstName} ${p.lastName} | UHID: ${p.uhid || "N/A"} | PatientID: ${p.patientId || "N/A"} | Age/Gender: ${p.age || "N/A"}/${p.gender} | Room/Bed: ${p.roomNo}/${p.bedNo} | Status: ${p.status} | Allergies: ${p.allergies?.join(",") || "None"} | Chronic Diseases: ${p.chronicDiseases?.join(",") || "None"}`
      ).join("\n");

      const staffSummary = staffList.map(s => 
        `- Name: ${s.firstName} ${s.lastName} | Role: ${s.role} | Department: ${s.department || "General"} | Status: ${s.status}`
      ).join("\n");

      const appointSummary = appointments.map(a => 
        `- Token #${a.tokenNumber} | Patient: ${a.patient?.firstName} ${a.patient?.lastName} | Doctor: Dr. ${a.doctor?.firstName} ${a.doctor?.lastName} | Time Slot: ${a.timeSlot} | Status: ${a.status} | Notes: ${a.notes || "None"}`
      ).slice(0, 15).join("\n");

      const admissionSummary = admissions.map(ad => 
        `- Patient: ${ad.patient?.firstName} ${ad.patient?.lastName} | Ward/Bed: ${ad.wardNo || ad.roomNo || "N/A"}/${ad.bedNo} | Admitted At: ${new Date(ad.admissionDate || ad.admittedAt || ad.createdAt).toLocaleString()} | Status: ${ad.status} | Department: ${ad.department}`
      ).slice(0, 15).join("\n");

      const vitalsSummary = vitals.map(v => 
        `- Patient: ${v.patient?.firstName} ${v.patient?.lastName} | SpO2: ${v.spo2}% | HR: ${v.heartRate} bpm | Temp: ${v.temperature}°F | BP: ${v.bp} | Sugar: ${v.sugar} | Recorded At: ${new Date(v.createdAt).toLocaleString()}`
      ).join("\n");

      const labsSummary = labs.map(l => 
        `- Patient: ${l.patient?.firstName} ${l.patient?.lastName} | Test: ${l.testName} | Prescribed By: Dr. ${l.prescribedBy?.firstName || "N/A"} | Status: ${l.status} | Results: ${l.results || "Pending"} | Emergency: ${l.isEmergency ? "YES" : "NO"}`
      ).join("\n");

      const medsSummary = medications.map(m => 
        `- Patient: ${m.patient?.firstName} ${m.patient?.lastName} | Medicine: ${m.medicationName} | Dosage: ${m.dosage} | Frequency: ${m.frequency} | Status: ${m.status}`
      ).join("\n");

      const consultationsSummary = consultations.map(c => 
        `- Patient: ${c.patient?.firstName} ${c.patient?.lastName} | Doctor: Dr. ${c.doctor?.firstName} ${c.doctor?.lastName} | Diagnosis: ${c.diagnosis} | Notes: ${c.clinicalNotes}`
      ).join("\n");

      const invoiceSummary = [
        ...invoices.map(i => `- Outpatient Invoice ${i.invoiceNumber} | Patient: ${i.patient?.firstName} ${i.patient?.lastName} | Amount: INR ${i.billAmount} | Status: ${i.paymentStatus} | Method: ${i.paymentMethod}`),
        ...billingInvoices.map(b => `- Inpatient Invoice ${b.billNumber} | Patient: ${b.patient?.firstName} ${b.patient?.lastName} | Item: ${b.itemName} | Amount: INR ${b.amount} | Status: ${b.paymentStatus}`)
      ].slice(0, 15).join("\n");

      const pharmacySummary = medicines.map(m => 
        `- Medicine: ${m.name} | Stock: ${m.stock} | Price: INR ${m.price} | Expiry: ${new Date(m.expiryDate).toLocaleDateString()}`
      ).join("\n");

      return `
Hospital: ${hospitalName} (${hospital ? hospital.code : "KIMS"})
Live Hospital Database Context (Current state of EMR):

PATIENTS RECORDS:
${patientSummary || "No patients registered."}

STAFF ROSTER:
${staffSummary || "No staff registered."}

TODAY'S SCHEDULED APPOINTMENTS:
${appointSummary || "No appointments registered."}

ACTIVE ADMISSIONS:
${admissionSummary || "No warded stays."}

LATEST PATIENT VITALS LOGS:
${vitalsSummary || "No vitals logged."}

LATEST LAB DIAGNOSTICS:
${labsSummary || "No lab requests logged."}

MEDICATIONS PRESCRIBED:
${medsSummary || "No medication rounds logged."}

CLINICAL CONSULTATIONS:
${consultationsSummary || "No clinical consult records."}

BILLING & INVOICES:
${invoiceSummary || "No invoices."}

PHARMACY DRUG STOCK:
${pharmacySummary || "No pharmacy inventories."}
`;
    } catch (error) {
      console.error("Error generating global hospital context:", error);
      return `Error generating global hospital context: ${error.message}`;
    }
  }
}

module.exports = BaseAIService;
