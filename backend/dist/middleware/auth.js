"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Role = void 0;
exports.authenticate = authenticate;
exports.requireRole = requireRole;
const aws_jwt_verify_1 = require("aws-jwt-verify");
const database_1 = require("../config/database");
const types_1 = require("../types");
exports.Role = types_1.UserRole;
let verifier = null;
function getVerifier() {
    if (verifier) {
        return verifier;
    }
    const userPoolId = process.env.COGNITO_USER_POOL_ID;
    const clientId = process.env.COGNITO_CLIENT_ID;
    if (!userPoolId || !clientId) {
        throw new Error("Missing COGNITO_USER_POOL_ID or COGNITO_CLIENT_ID environment variables");
    }
    verifier = aws_jwt_verify_1.CognitoJwtVerifier.create({
        userPoolId,
        tokenUse: "id",
        clientId,
    });
    return verifier;
}
function mapGroupToRole(group) {
    switch (group) {
        case types_1.UserRole.ADMIN:
            return types_1.UserRole.ADMIN;
        case types_1.UserRole.PARISH_PRIEST:
            return types_1.UserRole.PARISH_PRIEST;
        case types_1.UserRole.PARISH_SECRETARY:
            return types_1.UserRole.PARISH_SECRETARY;
        case types_1.UserRole.REQUESTER:
        default:
            return types_1.UserRole.REQUESTER;
    }
}
function getBearerToken(req) {
    const authorizationHeader = req.headers.authorization;
    if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
        return null;
    }
    const token = authorizationHeader.slice("Bearer ".length).trim();
    return token || null;
}
async function authenticate(req, res, next) {
    try {
        const token = getBearerToken(req);
        if (!token) {
            return res.status(401).json({ message: "No token provided" });
        }
        const payload = await getVerifier().verify(token);
        const groups = payload["cognito:groups"];
        const group = Array.isArray(groups) && groups.length > 0 ? groups[0] : undefined;
        const sub = payload.sub;
        const email = typeof payload.email === "string" ? payload.email : "";
        const cognitoUsername = typeof payload["cognito:username"] === "string" ? payload["cognito:username"] : email;
        const authTime = typeof payload.auth_time === "number" ? payload.auth_time : undefined;
        if (!sub || !email) {
            console.error("Token verified but missing required claims:", { sub, email, payload });
            return res.status(401).json({ message: "Invalid token" });
        }
        let role = mapGroupToRole(group);
        let userId = sub;
        try {
            const client = await database_1.pool.connect();
            try {
                const userResult = await client.query(`SELECT id, role FROM "User" WHERE email = $1`, [email]);
                if (userResult.rows.length > 0) {
                    userId = userResult.rows[0].id;
                    const dbRole = userResult.rows[0].role;
                    role = mapGroupToRole(dbRole);
                }
            }
            finally {
                client.release();
            }
        }
        catch (dbError) {
            console.warn("Role lookup failed; continuing with Cognito role only:", dbError);
        }
        req.user = {
            id: userId,
            email,
            role,
            cognitoUsername,
            cognitoSub: sub,
            authTime,
        };
        return next();
    }
    catch (error) {
        console.error("Token verification failed:", error);
        return res.status(401).json({ message: "Invalid token" });
    }
}
function requireRole(allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            console.warn(`[ROLE_GUARD] User ${req.user?.email} has role ${req.user?.role}, allowed: ${allowedRoles.join(", ")}`);
            return res.status(403).json({ message: "Insufficient permissions" });
        }
        return next();
    };
}
//# sourceMappingURL=auth.js.map