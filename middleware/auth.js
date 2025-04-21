const isAdmin = (req, res, next) => {
    if (!req.user) {
      return res.status(401).send("Unauthorized: Please log in first");
    }
    
    if (req.user.role !== "ADMIN") {
      return res.status(403).send("Access Denied: Admins Only");
    }
  
    next();
  };
  module.exports={
    isAdmin,
}