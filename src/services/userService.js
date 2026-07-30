const User = require("../models/userModel");
const AppError = require("../utils/appError");

class UserService {
  /**
   * Create a new staff user or patient
   * @param {Object} userData
   */
  async createUser(userData) {
    const { email, mobile, role, employeeId } = userData;

    // Check for valid role
    const validRoles = [
      "SUPER_ADMIN",
      "ADMIN",
      "DOCTOR",
      "RECEPTIONIST",
      "NURSE",
      "LAB_TECHNICIAN",
      "PHARMACIST",
      "CASHIER",
      "PATIENT",
    ];

    if (role && !validRoles.includes(role)) {
      throw new AppError(`Invalid role '${role}'. Allowed roles: ${validRoles.join(", ")}`, 400);
    }

    // Check if email already exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      throw new AppError("A user with this email address already exists", 409);
    }

    // Check if mobile already exists
    const existingMobile = await User.findOne({ mobile });
    if (existingMobile) {
      throw new AppError("A user with this mobile number already exists", 409);
    }

    // Auto-generate employeeId if staff and not provided
    if (role !== "PATIENT" && !employeeId) {
      const count = await User.countDocuments({ role: { $ne: "PATIENT" } });
      userData.employeeId = `EMP-${1000 + count + 1}`;
    }

    // Auto-generate UHID if Patient based on Hospital Code and Registration Type
    if (role === "PATIENT" && !userData.uhid) {
      const Hospital = require("../models/hospitalModel");
      let hospitalCode = "UHID";
      if (userData.hospital) {
        const hosp = await Hospital.findById(userData.hospital);
        if (hosp && hosp.code) {
          hospitalCode = hosp.code.toUpperCase();
        }
      }

      const regType = userData.registrationType || "WALK_IN";
      let typeChar = "W";
      if (regType === "ONLINE") typeChar = "O";
      if (regType === "EMERGENCY") typeChar = "E";
      if (regType === "REFERRAL") typeChar = "R";

      const pCount = await User.countDocuments({ role: "PATIENT", hospital: userData.hospital });
      const seqStr = String(pCount + 1).padStart(6, "0");
      userData.uhid = `${hospitalCode}_${typeChar}_${seqStr}`;
    }

    // Auto-generate Patient ID if Patient based on total sequence count
    if (role === "PATIENT" && !userData.patientId) {
      const count = await User.countDocuments({ role: "PATIENT" });
      userData.patientId = `PAT-${10000 + count + 1}`;
    }

    // Create user
    const user = await User.create(userData);
    return user;
  }

  /**
   * Get users with Search, Pagination, and Filters
   * @param {Object} queryParams
   */
  async getUsers(queryParams) {
    const {
      page = 1,
      limit = 10,
      search,
      q,
      role,
      department,
      branch,
      status,
      hospital,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = queryParams;

    const query = {};

    // Filter by hospital
    if (hospital) {
      query.hospital = hospital;
    }

    // Search filter
    const searchTerm = search || q;
    if (searchTerm) {
      const searchRegex = new RegExp(searchTerm.trim(), "i");
      query.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { mobile: searchRegex },
        { employeeId: searchRegex },
        { uhid: searchRegex },
        { patientId: searchRegex },
        { "insurance.policyNumber": searchRegex },
      ];
    }

    if (role) {
      query.role = typeof role === "string" ? role.toUpperCase() : role;
    }

    // Filter by department
    if (department) {
      query.department = new RegExp(`^${department.trim()}$`, "i");
    }

    // Filter by branch
    if (branch) {
      query.branch = new RegExp(`^${branch.trim()}$`, "i");
    }

    // Filter by status
    if (status) {
      query.status = status.toUpperCase();
    }

    // Filter by registrationType
    if (queryParams.registrationType) {
      query.registrationType = queryParams.registrationType.toUpperCase();
    }

    // Pagination calculations
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    console.log("[userService.getUsers] Built Mongoose query:", JSON.stringify(query, null, 2));

    const [users, totalRecords] = await Promise.all([
      User.find(query).sort(sort).skip(skip).limit(limitNum),
      User.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalRecords / limitNum) || 1;

    return {
      users,
      pagination: {
        totalRecords,
        totalPages,
        currentPage: pageNum,
        limit: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    };
  }

  /**
   * Get single user by ID
   * @param {string} userId
   */
  async getUserById(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError(`User not found with ID: ${userId}`, 404);
    }
    return user;
  }

  /**
   * Update user details
   * @param {string} userId
   * @param {Object} updateData
   */
  async updateUser(userId, updateData) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError(`User not found with ID: ${userId}`, 404);
    }

    if (updateData.email && updateData.email !== user.email) {
      const existingEmail = await User.findOne({ email: updateData.email });
      if (existingEmail) {
        throw new AppError("A user with this email address already exists", 409);
      }
    }

    if (updateData.mobile && updateData.mobile !== user.mobile) {
      const existingMobile = await User.findOne({ mobile: updateData.mobile });
      if (existingMobile) {
        throw new AppError("A user with this mobile number already exists", 409);
      }
    }

    delete updateData.password;

    Object.assign(user, updateData);
    await user.save();

    return user;
  }

  /**
   * Delete user by ID with active safeguards
   * @param {string} userId
   */
  async deleteUser(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError(`User not found with ID: ${userId}`, 404);
    }

    // Deletion Safeguard: Cannot delete doctor if status is ACTIVE
    if (user.role === "DOCTOR" && user.status === "ACTIVE") {
      throw new AppError(
        `Active Safeguard: Cannot delete Doctor ${user.firstName} ${user.lastName} while status is ACTIVE. Please deactivate account first.`,
        400
      );
    }

    await user.deleteOne();
    return true;
  }

  /**
   * Enable or Disable user (Set status ACTIVE or INACTIVE)
   * @param {string} userId
   * @param {string} status
   */
  async setUserStatus(userId, status) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError(`User not found with ID: ${userId}`, 404);
    }

    user.status = status;
    await user.save();

    return user;
  }

  /**
   * Check if a duplicate patient already exists with matching mobile, email, or firstName + lastName + dob
   */
  async checkDuplicatePatient(data) {
    const { mobile, email, firstName, lastName, dob, hospital, excludeId } = data;

    const queryConditions = [];
    
    if (mobile) {
      queryConditions.push({ mobile });
    }
    if (email) {
      queryConditions.push({ email });
    }
    if (firstName && lastName && dob) {
      queryConditions.push({
        firstName: new RegExp(`^${firstName.trim()}$`, "i"),
        lastName: new RegExp(`^${lastName.trim()}$`, "i"),
        dob: new Date(dob),
      });
    }

    if (queryConditions.length === 0) {
      return null;
    }

    const matchQuery = {
      role: "PATIENT",
      hospital,
      $or: queryConditions
    };

    if (excludeId) {
      matchQuery._id = { $ne: excludeId };
    }

    const duplicate = await User.findOne(matchQuery);
    return duplicate;
  }

  /**
   * Merge secondary duplicate patient record into primary patient record
   */
  async mergePatients(primaryId, secondaryId, hospitalId) {
    const [primaryPatient, secondaryPatient] = await Promise.all([
      User.findById(primaryId),
      User.findById(secondaryId)
    ]);

    if (!primaryPatient || primaryPatient.role !== "PATIENT") {
      throw new AppError("Primary patient not found", 404);
    }
    if (!secondaryPatient || secondaryPatient.role !== "PATIENT") {
      throw new AppError("Duplicate patient to merge not found", 404);
    }

    if (primaryPatient.hospital.toString() !== hospitalId.toString() ||
        secondaryPatient.hospital.toString() !== hospitalId.toString()) {
      throw new AppError("Patients must belong to your hospital to merge", 403);
    }

    // Lazy load models to prevent circular references
    const { Appointment, Invoice, AdmissionRecord } = require("../models/receptionModel");
    const { VitalsRecord, MedicationRecord, DoctorInstruction, NursingNote, LabRequest, Consultation } = require("../models/clinicalModel");
    const { BillingInvoice } = require("../models/billingModel");
    const AdvancePayment = require("../models/advancePaymentModel");
    const { PharmacyBill } = require("../models/pharmacyModel");

    // Update patient references in all collections
    const collectionsToUpdate = [
      { model: Appointment, field: "patient" },
      { model: Invoice, field: "patient" },
      { model: AdmissionRecord, field: "patient" },
      { model: VitalsRecord, field: "patient" },
      { model: MedicationRecord, field: "patient" },
      { model: DoctorInstruction, field: "patient" },
      { model: NursingNote, field: "patient" },
      { model: LabRequest, field: "patient" },
      { model: Consultation, field: "patient" },
      { model: BillingInvoice, field: "patient" },
      { model: AdvancePayment, field: "patient" },
      { model: PharmacyBill, field: "patient" }
    ];

    for (const item of collectionsToUpdate) {
      await item.model.updateMany(
        { [item.field]: secondaryId },
        { $set: { [item.field]: primaryId } }
      );
    }

    // Update family mappings in other users that refer to secondaryId
    const usersWithSecondaryFamily = await User.find({ "familyMapping.patient": secondaryId });
    for (const user of usersWithSecondaryFamily) {
      let alreadyHasPrimary = false;
      let secondaryIndex = -1;
      
      for (let i = 0; i < user.familyMapping.length; i++) {
        const fam = user.familyMapping[i];
        if (fam.patient && fam.patient.toString() === primaryId.toString()) {
          alreadyHasPrimary = true;
        }
        if (fam.patient && fam.patient.toString() === secondaryId.toString()) {
          secondaryIndex = i;
        }
      }

      if (secondaryIndex !== -1) {
        if (alreadyHasPrimary) {
          user.familyMapping.splice(secondaryIndex, 1);
        } else {
          user.familyMapping[secondaryIndex].patient = primaryId;
        }
        await user.save();
      }
    }

    // Merge EMR clinical fields
    const allergiesSet = new Set([
      ...(primaryPatient.allergies || []),
      ...(secondaryPatient.allergies || [])
    ]);
    primaryPatient.allergies = Array.from(allergiesSet);

    const chronicSet = new Set([
      ...(primaryPatient.chronicDiseases || []),
      ...(secondaryPatient.chronicDiseases || [])
    ]);
    primaryPatient.chronicDiseases = Array.from(chronicSet);

    const vacSet = new Set([
      ...(primaryPatient.vaccinations || []),
      ...(secondaryPatient.vaccinations || [])
    ]);
    primaryPatient.vaccinations = Array.from(vacSet);

    const alertsSet = new Set([
      ...(primaryPatient.medicalAlerts || []),
      ...(secondaryPatient.medicalAlerts || [])
    ]);
    primaryPatient.medicalAlerts = Array.from(alertsSet);

    // Merge attributes
    if (!primaryPatient.dob && secondaryPatient.dob) {
      primaryPatient.dob = secondaryPatient.dob;
    }
    if (!primaryPatient.age && secondaryPatient.age) {
      primaryPatient.age = secondaryPatient.age;
    }
    if (!primaryPatient.address && secondaryPatient.address) {
      primaryPatient.address = secondaryPatient.address;
    }
    if ((!primaryPatient.profilePhoto || primaryPatient.profilePhoto.includes("default-avatar.png")) && 
        secondaryPatient.profilePhoto && !secondaryPatient.profilePhoto.includes("default-avatar.png")) {
      primaryPatient.profilePhoto = secondaryPatient.profilePhoto;
    }
    if ((!primaryPatient.emergencyContact || primaryPatient.emergencyContact === "N/A") && secondaryPatient.emergencyContact) {
      primaryPatient.emergencyContact = secondaryPatient.emergencyContact;
    }

    // Merge Insurance
    if ((!primaryPatient.insurance || !primaryPatient.insurance.provider) && secondaryPatient.insurance && secondaryPatient.insurance.provider) {
      primaryPatient.insurance = secondaryPatient.insurance;
    }

    // Merge Family Mappings
    const familyMap = {};
    for (const fam of primaryPatient.familyMapping || []) {
      if (fam.patient) {
        familyMap[fam.patient.toString()] = fam.relation;
      }
    }
    for (const fam of secondaryPatient.familyMapping || []) {
      if (fam.patient) {
        const famId = fam.patient.toString();
        if (famId !== secondaryId.toString() && famId !== primaryId.toString() && !familyMap[famId]) {
          primaryPatient.familyMapping.push(fam);
        }
      }
    }

    await primaryPatient.save();

    // Delete the duplicate user
    await secondaryPatient.deleteOne();

    return primaryPatient;
  }
}

module.exports = new UserService();
