// In middleware/authetication.js
const { validateToken } = require("../service/authentication");

function checkForAthenticationCookie(cookieName) {
  return async (req, res, next) => {
    const tokenCookieValue = req.cookies[cookieName];
    if (!tokenCookieValue) {
      console.log('No token cookie found');
      return next();
    }
    try {
      const userPayload = await validateToken(tokenCookieValue);
      if (!userPayload) {
        console.error('No user payload returned from validateToken');
        res.clearCookie(cookieName);
        return next();
      }
      req.user = userPayload;
      console.log(`Authenticated user: ${userPayload._id} (${userPayload.role})`);
      next();
    } catch (error) {
      console.error('Authentication error:', error.message);
      res.clearCookie(cookieName);
      next();
    }
  };
}

module.exports = {
  checkForAthenticationCookie,
};