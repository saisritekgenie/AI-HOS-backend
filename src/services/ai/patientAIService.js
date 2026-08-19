const BaseAIService = require("./baseAIService");
const User = require("../../models/userModel");
const { Appointment } = require("../../models/receptionModel");
const { LabRequest } = require("../../models/clinicalModel");

class PatientAIService extends BaseAIService {
  async processChat(queryType, content, patientId) {
    const lower = (content || "").toLowerCase();

    if (this.isGreeting(content)) {
      return {
        reply: "Hello! I am your AI Health Assistant. I can help you find your upcoming appointments, check who your assigned doctor is, list your recent completed lab reports, or check symptoms. How can I help you today?",
        keyTakeaways: ["I assist with patient records lookup and basic symptom checks."],
        recommendations: ["Ask 'Who is my doctor?' or 'When is my next appointment?'"]
      };
    }

    // Resolve current patient details
    const patient = await User.findById(patientId).populate("assignedDoctor", "firstName lastName department mobile availability");

    let doctorAvailable = false;
    let doctorInfo = null;

    if (patient && patient.assignedDoctor) {
      const doc = patient.assignedDoctor;
      const docName = `Dr. ${doc.firstName} ${doc.lastName}`;
      const dept = doc.department || "General Medicine";
      const mobile = doc.mobile || "N/A";
      
      const availability = doc.availability || {
        days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        startTime: "09:00 AM",
        endTime: "05:00 PM"
      };

      // Check current day and time availability
      const currentDay = new Date().toLocaleDateString("en-US", { weekday: "long" });
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const parseTimeToMinutes = (timeStr) => {
        if (!timeStr) return 0;
        const match = timeStr.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
        if (!match) return 0;
        let hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const ampm = match[3].toUpperCase();
        if (ampm === "PM" && hours < 12) hours += 12;
        if (ampm === "AM" && hours === 12) hours = 0;
        return hours * 60 + minutes;
      };

      const startMin = parseTimeToMinutes(availability.startTime);
      const endMin = parseTimeToMinutes(availability.endTime);
      
      const dayMatches = (availability.days || []).includes(currentDay);
      const timeMatches = currentMinutes >= startMin && currentMinutes <= endMin;

      doctorAvailable = dayMatches && timeMatches;

      doctorInfo = {
        name: docName,
        mobile,
        department: dept,
        isAvailable: doctorAvailable,
        availabilityText: `${availability.days.join(", ")} from ${availability.startTime} to ${availability.endTime}`
      };
    }

    // 1. Who is my doctor / availability
    if (lower.includes("doctor") || lower.includes("physician") || lower.includes("practitioner")) {
      if (doctorInfo) {
        const availabilityStatus = doctorInfo.isAvailable ? "Available Now (On-Duty)" : "Off-Duty (Currently Unavailable)";
        return {
          reply: `Your assigned primary care physician is ${doctorInfo.name} in the ${doctorInfo.department} department. Direct Mobile: ${doctorInfo.mobile}. Availability: ${doctorInfo.availabilityText}. Current status: ${availabilityStatus}.`,
          keyTakeaways: [`Primary care: ${doctorInfo.name}.`, `Department: ${doctorInfo.department}.`],
          recommendations: ["Check available consultation times in online booking.", doctorInfo.isAvailable ? "Call your doctor directly." : "Leave an urgent offline message for your doctor."]
        };
      } else {
        return {
          reply: "You do not have a primary care physician assigned yet. Please contact the front desk receptionist to schedule an initial consultation.",
          keyTakeaways: ["No doctor assigned yet."],
          recommendations: ["Book an appointment to set up your primary doctor assignment."]
        };
      }
    }

    // 2. Next appointment
    if (lower.includes("appointment") || lower.includes("booking") || lower.includes("schedule")) {
      const appointments = await Appointment.find({ patient: patientId })
        .populate("doctor", "firstName lastName")
        .sort({ appointmentDate: 1 });

      const upcoming = appointments.filter(a => a.status === "BOOKED" || a.status === "CHECKED_IN");
      if (upcoming.length > 0) {
        const appt = upcoming[0];
        const dateStr = new Date(appt.appointmentDate).toLocaleDateString();
        return {
          reply: `Your next upcoming appointment is with Dr. ${appt.doctor?.firstName} ${appt.doctor?.lastName} on ${dateStr} at ${appt.timeSlot}. Token number: ${appt.tokenNumber}.`,
          keyTakeaways: [`Appointment scheduled: ${dateStr} at ${appt.timeSlot}.`, `Token number: ${appt.tokenNumber}.`],
          recommendations: ["Please check in at the reception desk 15 minutes prior to slot.", "Keep your UHID card handy."]
        };
      } else {
        return {
          reply: "You do not have any active upcoming appointments scheduled.",
          keyTakeaways: ["No active appointments found."],
          recommendations: ["Click 'Online Booking' on the portal to schedule a consult."]
        };
      }
    }

    // 3. Lab reports
    if (lower.includes("lab") || lower.includes("report") || lower.includes("test") || lower.includes("result") || lower.includes("cbc") || lower.includes("sugar") || lower.includes("ecg")) {
      const labs = await LabRequest.find({ patient: patientId, status: "COMPLETED" });
      if (labs.length > 0) {
        const reports = labs.map(l => `${l.testName}: ${l.results}`).join("; ");
        return {
          reply: `Here are your recent completed lab results: ${reports}.`,
          keyTakeaways: ["Completed lab results are logged in EHR.", "Always discuss abnormal values with your doctor."],
          recommendations: ["Check EMR portal for report download link.", "Discuss findings during your next consultation."]
        };
      } else {
        return {
          reply: "We could not locate any completed lab report files for your profile in the database.",
          keyTakeaways: ["No lab reports found."],
          recommendations: ["Verify with lab technician if sample processing is complete."]
        };
      }
    }

    // 4. Symptom check fallback / Emergency detection
    const isEmergencyQuery = lower.includes("chest pain") || lower.includes("breathing") || lower.includes("shortness") || lower.includes("cardiac") || lower.includes("heart attack") || lower.includes("stroke") || lower.includes("severe pain") || lower.includes("unconscious");

    if (isEmergencyQuery || queryType === "symptom-checker" || lower.includes("symptom") || lower.includes("fever") || lower.includes("pain") || lower.includes("cough")) {
      if (isEmergencyQuery) {
        return {
          reply: "⚠️ Critical Warning: The symptoms you described (such as chest pain, breathing difficulty, or cardiac concerns) can be signs of a medical emergency. Please do not wait. Immediate medical attention is highly advised.",
          keyTakeaways: ["High severity symptoms detected.", "Immediate emergency evaluation needed."],
          recommendations: [
            "🚨 CONTACT EMERGENCY SERVICES (911 / 108) IMMEDIATELY OR GO TO THE NEAREST EMERGENCY ROOM.",
            "Rest completely and avoid any exertion."
          ],
          isEmergency: true,
          doctor: doctorInfo
        };
      }

      return {
        reply: "I understand you are feeling unwell. Based on symptoms (mild fever, cold, or discomfort), ensure you get adequate rest and hydration. Please monitor your symptoms.",
        keyTakeaways: ["Rest and fluids are essential for common cold/fever.", "Monitor body temperature daily."],
        recommendations: ["Book a consultation with your doctor if symptoms persist.", "Take prescribed antipyretics if advised."]
      };
    }

    return {
      reply: "Hello! I am your AI Health Assistant. I can explain your diagnostic results, check upcoming appointments, or guide you on symptoms. What can I clarify for you today?",
      keyTakeaways: ["Advisory assistance only.", "Admissions and clinic data is synced live."],
      recommendations: ["Ask about appointments, doctor details, or recent lab tests."]
    };
  }
}

module.exports = new PatientAIService();
