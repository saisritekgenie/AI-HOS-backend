const AuditLog = require("../models/auditLogModel");
const User = require("../models/userModel");

class AuditLogService {
  /**
   * CENTRALIZED METHOD TO LOG AN ACTIVITY
   * Runs asynchronously in the background. It will not block HTTP thread responses.
   * @param {object} req - Express Request object (to parse IP, User-Agent, and Auth Session)
   * @param {object} data - Action options: { module, action, details, status, targetId, targetName, user, hospital }
   */
  async logActivity(req, data = {}) {
    try {
      const performedBy = data.user?._id || req?.user?._id;
      const userRole = data.user?.role || req?.user?.role;
      const hospital = data.hospital || req?.user?.hospital;

      if (!performedBy || !userRole) {
        // Skip logs if request session contains no user details
        return;
      }

      // Auto-parse IP Address from request headers
      let ipAddress = "Unknown";
      if (req) {
        ipAddress = req.headers["x-forwarded-for"] || 
                    req.socket.remoteAddress || 
                    req.ip || 
                    "Unknown";
      }

      // Auto-parse Device user-agent string
      const deviceRaw = req?.headers?.["user-agent"] || "Unknown";
      let device = "Desktop Browser";
      if (deviceRaw.toLowerCase().includes("mobile")) {
        device = "Mobile App / Browser";
      } else if (deviceRaw.toLowerCase().includes("postman")) {
        device = "API Client (Postman)";
      } else if (deviceRaw !== "Unknown") {
        const match = deviceRaw.match(/\(([^)]+)\)/);
        device = match ? match[1].split(";")[0] : "Desktop Client";
      }

      await AuditLog.create({
        hospital,
        performedBy,
        userRole,
        module: data.module,
        action: data.action,
        status: data.status || "SUCCESS",
        details: data.details || "",
        ipAddress,
        device,
        targetId: data.targetId || "",
        targetName: data.targetName || "",
      });
    } catch (err) {
      console.error("❌ Central Audit Logging Failed:", err.message);
    }
  }

  /**
   * QUERY AUDIT LOGS FOR DASHBOARD VIEW
   * @param {string} hospitalId - Tenant hospital constraint
   * @param {object} params - Query filters
   */
  async queryLogs(hospitalId, params = {}) {
    const { 
      page = 1, 
      limit = 20, 
      module, 
      action, 
      status, 
      startDate, 
      endDate, 
      search,
      performedBy
    } = params;

    const query = { hospital: hospitalId };

    // Module Filter
    if (module) {
      query.module = module;
    }

    // Action Filter
    if (action) {
      query.action = action;
    }

    // Status Filter
    if (status) {
      query.status = status;
    }

    // Date Range Filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    // Performed By User Filter
    if (performedBy) {
      query.performedBy = performedBy;
    }

    // Search Query (by targetName, details, targetId, or looking up target users)
    if (search && search.trim()) {
      const matchQuery = search.trim();
      
      // Attempt to find users matching search to search by performedBy
      const matchedUsers = await User.find({
        hospital: hospitalId,
        $or: [
          { firstName: { $regex: matchQuery, $options: "i" } },
          { lastName: { $regex: matchQuery, $options: "i" } },
          { uhid: { $regex: matchQuery, $options: "i" } }
        ]
      }).select("_id");

      const userIds = matchedUsers.map(u => u._id);

      query.$or = [
        { performedBy: { $in: userIds } },
        { targetName: { $regex: matchQuery, $options: "i" } },
        { details: { $regex: matchQuery, $options: "i" } },
        { targetId: { $regex: matchQuery, $options: "i" } }
      ];
    }

    const count = await AuditLog.countDocuments(query);
    const logs = await AuditLog.find(query)
      .populate("performedBy", "firstName lastName uhid role")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    return {
      logs,
      total: count,
      page: Number(page),
      pages: Math.ceil(count / limit),
    };
  }
}

module.exports = new AuditLogService();
