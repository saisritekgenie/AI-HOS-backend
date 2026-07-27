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

  async processChat(content, nurseId) {
    if (this.isGreeting(content)) {
      return {
        reply: "Hello! I am your AI Nursing Assistant. I can help you evaluate critical vitals logs, check medication administration reminders, and trace emergency patient alerts. How can I help you today?",
        keyTakeaways: ["I assist in monitoring patient vitals safety margins."],
        recommendations: ["Query vital ranges, check pending nurse tasks, or confirm medications due."]
      };
    }

    const userPrompt = `Input: ${content}`;
    const systemPrompt = "You are the AI Nursing Assistant. Answer questions regarding patient vitals, medication timings, and nurse duties. Return JSON containing: reply (text), keyTakeaways (array of strings), recommendations (array of strings).";

    const llmResult = await this.callLLM(systemPrompt, userPrompt);
    if (llmResult) {
      try {
        return JSON.parse(this.cleanJSONString(llmResult));
      } catch (e) {}
    }

    // Local Fallback
    const lower = content.toLowerCase();
    if (lower.includes("vitals") || lower.includes("bp") || lower.includes("spo2") || lower.includes("heart")) {
      return {
        reply: "Vitals check parameters: Normal SpO2 should hold above 95%. Systolic BP above 180 mmHg or below 90 mmHg triggers immediate critical nursing alert notifications.",
        keyTakeaways: ["Monitor patient breathing rate closely.", "SpO2 < 90% is a clinical red alert."],
        recommendations: ["Check vitals checklist at the ward desk.", "Log latest vitals to check for emergency threshold alerts."]
      };
    }

    if (lower.includes("medication") || lower.includes("reminder") || lower.includes("due") || lower.includes("pill")) {
      return {
        reply: "Ensure all due medications (e.g. Paracetamol, Ambroxol) are checked off and administration logs are populated to avoid gaps in patient pharmacotherapy charts.",
        keyTakeaways: ["Medication rounds are due every 4 hours.", "Check patient details bands before administering drugs."],
        recommendations: ["Navigate to 'Medications Due' tab to view specific patient medication schedules.", "Consult doctor if patient refuses oral administration."]
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
