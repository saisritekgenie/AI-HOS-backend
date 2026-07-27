const BaseAIService = require("./baseAIService");

class PatientAIService extends BaseAIService {
  async processChat(queryType, content) {
    if (this.isGreeting(content)) {
      return {
        reply: "Hello! I am your AI Health Assistant. I can help you understand your symptoms, explain your lab report values, clarify your prescribed pill dosages, or help you request a doctor appointment. How can I help you today?",
        keyTakeaways: ["AI health advice is advisory only."],
        recommendations: ["For clinical urgencies, please consult your hospital physician directly."]
      };
    }

    const userPrompt = `Type: ${queryType}. Input: ${content}`;
    const systemPrompt = "You are a compassionate, helpful patient medical buddy chat assistant. Explain terms, symptoms, or reports in extremely simple layman terms. Always emphasize: 'This is an advisory explanation only. Final medical decisions rest with your doctor.' Return JSON containing: reply (friendly response text), keyTakeaways (array of strings), recommendations (array of strings).";

    const llmResult = await this.callLLM(systemPrompt, userPrompt);
    if (llmResult) {
      try {
        return JSON.parse(this.cleanJSONString(llmResult));
      } catch (e) {}
    }

    // Local Fallback
    if (queryType === "symptom-checker") {
      const lower = content.toLowerCase();
      let reply = "I understand you are experiencing discomfort. Based on your symptoms, here is an initial checklist to monitor. Remember to consult a physician for diagnostic verification.";
      let keyTakeaways = ["Observe symptom progression", "Stay hydrated and rest"];
      let recommendations = ["Schedule a routine physician consult", "Seek emergency room care if symptoms worsen drastically"];

      if (lower.includes("fever") || lower.includes("cold") || lower.includes("cough")) {
        reply = "You described symptoms consistent with a common viral illness, such as a cold or low-grade fever. Ensure you monitor your temperature regularly.";
        keyTakeaways = ["Fever indicates your immune system is active", "Hydration is key to viral recovery"];
        recommendations = ["Rest and stay hydrated", "Consult a doctor if temperature exceeds 102°F or persists past 3 days"];
      } else if (lower.includes("chest pain") || lower.includes("breathing") || lower.includes("shortness of breath")) {
        reply = "⚠️ Warning: You reported respiratory or chest discomfort. These can be symptoms of a serious cardiovascular or pulmonary condition.";
        keyTakeaways = ["Chest pain requires immediate medical assessment", "Do not delay professional evaluation"];
        recommendations = ["🚨 SEEK EMERGENCY MEDICAL ATTENTION IMMEDIATELY", "Do not engage in physical exertion"];
      }

      return { reply, keyTakeaways, recommendations };
    }

    if (queryType === "report-explanation" || queryType === "prescription-explanation") {
      return {
        reply: `Here is a simple explanation of your requested item: "${content}". Doctors use standard shorthand to log observations. This summary makes the technical details easier to digest.`,
        keyTakeaways: [
          "Follow dosage times precisely as prescribed.",
          "Finish full courses of prescribed therapeutics."
        ],
        recommendations: [
          "Confirm potential allergies with your nurse or pharmacist.",
          "Discuss any questions about this report directly during your next follow-up check."
        ]
      };
    }

    return {
      reply: "Hello! I am your AI Health Assistant. I can explain your diagnostic results, outline your prescriptions, or provide initial advice on symptoms. What can I help clarify for you today?",
      keyTakeaways: ["AI assistance is for patient guidance only."],
      recommendations: ["Check in with your assigned doctor for primary medical advice."]
    };
  }
}

module.exports = new PatientAIService();
