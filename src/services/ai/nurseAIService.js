const BaseAIService = require("./baseAIService");

class NurseAIService extends BaseAIService {
  async getEmergencyVitalsAlert(vitals) {
    if (!vitals) return { isEmergency: false, alertMessage: "" };

    const spo2 = vitals.spo2 ? parseFloat(vitals.spo2) : null;
    const hr = vitals.heartRate ? parseFloat(vitals.heartRate) : null;
    const temp = vitals.temperature ? parseFloat(vitals.temperature) : null;
    
    let systolic = null;
    if (vitals.bp && vitals.bp.includes("/")) {
      systolic = parseFloat(vitals.bp.split("/")[0]);
    }

    let isEmergency = false;
    const redFlags = [];

    if (spo2 !== null && spo2 < 90) {
      isEmergency = true;
      redFlags.push(`Severe Hypoxia (SpO2: ${spo2}% is below 90%)`);
    }
    if (hr !== null && (hr > 130 || hr < 45)) {
      isEmergency = true;
      redFlags.push(`Abnormal Heart Rate (${hr} bpm is in critical threshold)`);
    }
    if (systolic !== null && (systolic > 180 || systolic < 80)) {
      isEmergency = true;
      redFlags.push(`Critical Systolic BP (${systolic} mmHg is highly unstable)`);
    }
    if (temp !== null && temp > 104) {
      isEmergency = true;
      redFlags.push(`Hyperpyrexia (Temperature: ${temp}°F exceeds 104°F)`);
    }

    return {
      isEmergency,
      alertMessage: isEmergency 
        ? `🚨 CRITICAL EMERGENCY ALERT: Patient is presenting unstable clinical signs - ${redFlags.join(", ")}. Notify immediate emergency response teams.`
        : ""
    };
  }

  async processChat(content, nurseId, activeTab) {
    const User = require("../../models/userModel");
    const nurseDoc = await User.findById(nurseId);
    const hospitalId = nurseDoc?.hospital;

    const lower = content.toLowerCase();

    // 1. Gather context data based on activeTab
    let tabContext = "";
    try {
      const { MedicationRecord, VitalsRecord } = require("../../models/clinicalModel");
      if (activeTab === "medications-due") {
        const pendingMedsCount = await MedicationRecord.countDocuments({ status: "DUE" });
        tabContext = `Active Dashboard page: Medications Due. Unadministered medications due count: ${pendingMedsCount}.`;
      } else if (activeTab === "critical-alerts") {
        const criticalCount = await VitalsRecord.countDocuments({ $or: [{ spo2: { $lt: 92 } }, { heartRate: { $gt: 130 } }] });
        tabContext = `Active Dashboard page: Critical Alerts. Patients with critical vitals alerts count: ${criticalCount}.`;
      } else if (activeTab === "pending-tasks") {
        tabContext = `Active Dashboard page: Pending Tasks. Checklist of nursing schedules and rounds.`;
      } else if (activeTab === "patients") {
        const inpatientCount = await User.countDocuments({ role: "PATIENT" });
        tabContext = `Active Dashboard page: Patient Management. Total inpatients warded: ${inpatientCount}.`;
      } else {
        tabContext = `Active Dashboard page: Nurse Duty Station.`;
      }
    } catch (err) {
      tabContext = `Active Dashboard page: ${activeTab}. Nurse clinical mode.`;
    }

    if (this.isGreeting(content)) {
      return {
        reply: `Hello! I am your AI Nursing Assistant. Currently assisting you on the ${activeTab || "nursing"} dashboard. I can help evaluate critical vitals logs, check medication administration reminders, and trace emergency patient alerts. How can I help you today?`,
        keyTakeaways: ["I assist in monitoring patient vitals safety margins."],
        recommendations: ["Query vital ranges, check pending nurse tasks, or confirm medications due."]
      };
    }

    // Retrieve global database context
    const dbContext = await this.getHospitalDatabaseContext(hospitalId, content);

    const userPrompt = `Dashboard Context: ${tabContext}\n\nLive Database Context:\n${dbContext}\n\nUser Request: ${content}`;
    const systemPrompt = "You are the AI Nursing Assistant. Answer questions regarding patient vitals, medication timings, warded beds, or nurse duties using the provided Live Database Context and Dashboard Context. Be extremely specific, reference actual patient names and records from the context. Return JSON containing: reply (text), keyTakeaways (array of strings), recommendations (array of strings).";

    const llmResult = await this.callLLM(systemPrompt, userPrompt);
    if (llmResult) {
      try {
        return JSON.parse(this.cleanJSONString(llmResult));
      } catch (e) {}
    }

    // Local Fallbacks based on activeTab
    if (activeTab === "medications-due" || lower.includes("medication") || lower.includes("due")) {
      try {
        const { MedicationRecord } = require("../../models/clinicalModel");
        const pendingMedsCount = await MedicationRecord.countDocuments({ status: "DUE" });
        return {
          reply: `Medication Administration status: There are ${pendingMedsCount} pending medication doses marked due in the EMR logs. Ensure they are checked off as you administer them.`,
          keyTakeaways: ["Always check patient identification wristbands before giving meds.", "Rounds are scheduled every 4 hours."],
          recommendations: ["Verify the dosage details on the medications list.", "Report refusal or side effects immediately to the doctor."]
        };
      } catch (e) {}
    }

    if (activeTab === "critical-alerts" || lower.includes("alert") || lower.includes("vitals")) {
      try {
        const { VitalsRecord } = require("../../models/clinicalModel");
        const criticalCount = await VitalsRecord.countDocuments({ $or: [{ spo2: { $lt: 92 } }, { heartRate: { $gt: 130 } }] });
        return {
          reply: `Clinical Alarm summary: Currently tracking ${criticalCount} active critical vitals logs (low SpO2 or extreme heart rates). Monitor these patients continuously.`,
          keyTakeaways: ["Normal SpO2 is > 95%. SpO2 < 90% is a clinical red alert.", "Keep emergency supplemental oxygen ready."],
          recommendations: ["Verify warded patient bed logs.", "Log new vital readings once verified manually."]
        };
      } catch (e) {}
    }

    if (activeTab === "pending-tasks") {
      return {
        reply: "Nursing Duty Checklist: Routine bed checks, EMR chart logs, and drug-dispense verifications are scheduled for the current shift.",
        keyTakeaways: ["Update vitals charts at least twice per shift.", "Verify doctor order comments regularly."],
        recommendations: ["Complete pending tasks sequentially.", "Report critical updates to the supervising nurse."]
      };
    }

    if (activeTab === "patients") {
      return {
        reply: "Patient Care Ward logs: Ensure all warded patients have their daily EMR files updated and vital logs generated.",
        keyTakeaways: ["Check for chronic diseases tags.", "Check patient details bands before administering drugs."],
        recommendations: ["Open charting drawer to update vitals.", "Consult doctor if clinical concerns arise."]
      };
    }

    return {
      reply: "Nursing tasks logs are stable. Please register new vital measurements if patient discomfort is reported.",
      keyTakeaways: ["Active critical alarms list is updated in real-time."],
      recommendations: ["Perform regular ward checks.", "Verify all critical vitals flags on the main dashboard."]
    };
  }
}

module.exports = new NurseAIService();
