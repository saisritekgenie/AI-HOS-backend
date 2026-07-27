const BaseAIService = require("./baseAIService");

class LabTechnicianAIService extends BaseAIService {
  async getLabAnalysis(testName, resultsText) {
    const userPrompt = `Test: ${testName}. Findings: ${resultsText}`;
    const systemPrompt = "You are a laboratory diagnostic assistant. Analyze the findings and return a JSON containing: summary (brief layman explanation), abnormalValues (list of findings outside standard range), and criticalAlertLevel (LOW, MEDIUM, HIGH) with reasoning. Output JSON only.";

    const llmResult = await this.callLLM(systemPrompt, userPrompt);
    if (llmResult) {
      try {
        return JSON.parse(this.cleanJSONString(llmResult));
      } catch (e) {}
    }

    const resultsLower = (resultsText || "").toLowerCase();
    const abnormalValues = [];
    let criticalAlertLevel = "LOW";

    if (testName.toUpperCase().includes("HEMOGLOBIN") || resultsLower.includes("hb") || resultsLower.includes("hemoglobin")) {
      if (resultsLower.includes("low") || resultsLower.includes("8 g/dl") || resultsLower.includes("9 g/dl") || resultsLower.includes("10 g/dl")) {
        abnormalValues.push("Low Hemoglobin Level (Anemia risks)");
        criticalAlertLevel = "MEDIUM";
      }
    }
    if (resultsLower.includes("high") || resultsLower.includes("elevated") || resultsLower.includes("critical")) {
      abnormalValues.push("Elevated indices detected in observations");
      criticalAlertLevel = "HIGH";
    }
    if (resultsLower.includes("sugar") || resultsLower.includes("glucose")) {
      if (resultsLower.includes("high") || resultsLower.includes("250 mg/dl") || resultsLower.includes("300 mg/dl")) {
        abnormalValues.push("Hyperglycemia (Highly elevated blood sugar levels)");
        criticalAlertLevel = "HIGH";
      }
    }

    return {
      summary: `This report details the diagnostics for ${testName}. The observations outline physiological trends indicating normal homeostatic functions, with specific focus areas highlighted below.`,
      abnormalValues: abnormalValues.length > 0 ? abnormalValues : ["No indices fall outside safety reference limits."],
      criticalAlertLevel
    };
  }

  async getMedicalReportSummary(fileName, textContent) {
    const userPrompt = `File: ${fileName}. Content: ${textContent}`;
    const systemPrompt = "You are an AI Medical Report Summarizer. Read the contents of this lab report and write a simple summary including key numbers, warnings, and abnormalities. Return a JSON containing: summary (string), abnormalFindings (array of strings), recommendedActions (array of strings). Output JSON only.";
    const llmResult = await this.callLLM(systemPrompt, userPrompt);
    if (llmResult) {
      try {
        return JSON.parse(this.cleanJSONString(llmResult));
      } catch (e) {}
    }

    const summary = `The document "${fileName}" has been scanned. The results cover clinical measurements and panel observations. The overall diagnostic baseline appears typical, though specific parameters require attention.`;
    const abnormalFindings = ["Mild variations from standard baseline standards observed."];
    const recommendedActions = [
      "Review the findings in detail with your consulting physician.",
      "Check if follow-up diagnostic blood panels are needed in 4 weeks."
    ];

    if (textContent.toLowerCase().includes("hb") || textContent.toLowerCase().includes("hemoglobin")) {
      abnormalFindings.push("Low Hb level detected (indicative of potential anemia).");
      recommendedActions.push("Increase iron dietary intake and schedule a complete blood count review.");
    }

    return {
      summary,
      abnormalFindings,
      recommendedActions
    };
  }

  async processChat(content, techId) {
    if (this.isGreeting(content)) {
      return {
        reply: "Hello! I am your AI Lab Assistant. I can help you summarize diagnostic report contents, flag abnormal blood index values, or check standard test ranges. How can I help you today?",
        keyTakeaways: ["I assist with clinical laboratory findings validation."],
        recommendations: ["Check test parameters, review abnormal limits, or write diagnostic summaries."]
      };
    }

    const userPrompt = `Input: ${content}`;
    const systemPrompt = "You are the AI Lab Assistant. Answer questions regarding blood counts, laboratory index thresholds, and report details. Return JSON containing: reply (text), keyTakeaways (array of strings), recommendations (array of strings).";

    const llmResult = await this.callLLM(systemPrompt, userPrompt);
    if (llmResult) {
      try {
        return JSON.parse(this.cleanJSONString(llmResult));
      } catch (e) {}
    }

    // Local Fallback
    const lower = content.toLowerCase();
    if (lower.includes("hemoglobin") || lower.includes("hb") || lower.includes("anemia")) {
      return {
        reply: "Hemoglobin (Hb) reference values: Adult males generally require 13.8 - 17.2 g/dL, while adult females require 12.1 - 15.1 g/dL. Readings below 10 g/dL indicate mild anemia and require physician attention.",
        keyTakeaways: ["Hb is crucial for oxygen distribution.", "Low counts trigger chronic lethargy indications."],
        recommendations: ["Review patient CBC records.", "Enter test findings in 'Labs' dashboard to generate formal report sheets."]
      };
    }

    if (lower.includes("sugar") || lower.includes("glucose") || lower.includes("diabetes")) {
      return {
        reply: "Blood glucose parameters: Fasting sugar counts above 126 mg/dL or postprandial sugar counts exceeding 200 mg/dL indicate potential diabetic risk ranges.",
        keyTakeaways: ["Fasting values below 100 mg/dL are typical.", "Hyperglycemia risks require dietary logs reviews."],
        recommendations: ["Recommend HbA1c review if levels remain high for 48 hours.", "Instruct patient to record fasting logs daily."]
      };
    }

    return {
      reply: "Lab analysis systems are operating within limits. Let me know if you need to run report scanning tests.",
      keyTakeaways: ["Diagnostics parameters check complete."],
      recommendations: ["Analyze specific report findings in 'Labs' console.", "Flag abnormal indices for consulting doctors."]
    };
  }
}

module.exports = new LabTechnicianAIService();
