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
}

module.exports = BaseAIService;
