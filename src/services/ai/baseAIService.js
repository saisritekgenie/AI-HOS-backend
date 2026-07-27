class BaseAIService {
  /**
   * Helper to perform actual LLM API call if keys are present
   */
  async callLLM(systemPrompt, userPrompt) {
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
              parts: [{ text: `${systemPrompt}\n\nUser Input Context:\n${userPrompt}` }]
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
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
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
