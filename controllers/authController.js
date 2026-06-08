const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const dns = require("dns").promises; // Built-in Node.js DNS module (async)
const { sendVerificationEmail } = require("../utils/emailService");

// Basic format validation
const validateEmailFormat = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

// Improved: Check both domain MX records + basic "live" username validation
const validateEmailDomainAndUser = async (email) => {
  try {
    const [localPart, domain] = email.split("@");
    
    if (!localPart || localPart.length < 1 || localPart.length > 64) {
      return { valid: false, message: "Invalid username part in email" };
    }

    // Basic username (local-part) validation - allow common characters
    const localRe = /^[a-zA-Z0-9._%+-]+$/;
    if (!localRe.test(localPart)) {
      return { valid: false, message: "Email username contains invalid characters" };
    }

    // MX Record check (domain must be able to receive email)
    const mxRecords = await dns.resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) {
      return { valid: false, message: "Domain does not have valid MX records" };
    }

    return { valid: true };
  } catch (err) {
    console.error(`Email validation failed for ${email}:`, err.message);
    return { 
      valid: false, 
      message: "Please use a valid email with live domain (MX records)" 
    };
  }
};

const validatePassword = (password) => {
  return password && password.length >= 6;
  // Add more rules (uppercase, number, special char) if needed
};

const authController = {
  signup: async (req, res) => {
    const { name, email, password } = req.body;
    const errors = [];

    // Input Validation
    if (!name || name.trim().length < 2) {
      errors.push("Name must be at least 2 characters long.");
    }

    if (!email || !validateEmailFormat(email)) {
      errors.push("Please provide a valid email address.");
    } else {
      // === Enhanced Check: Live username + Domain with MX records ===
      const emailCheck = await validateEmailDomainAndUser(email);
      if (!emailCheck.valid) {
        errors.push(emailCheck.message);
      }
    }

    if (!password || !validatePassword(password)) {
      errors.push("Password must be at least 6 characters long.");
    }

    if (errors.length > 0) {
      return res.render("signup", { errors, name, email }); // Repopulate form
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Create user (add isVerified: false column in DB if needed)
      await User.createWithVerification(name, email, hashedPassword); // Updated model method

      // Generate verification token
      const verificationToken = jwt.sign(
        { email },
        process.env.VERIFICATION_SECRET || process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Send verification email via real SMTP
      await sendVerificationEmail(email, verificationToken);

      res.render("signup", { 
        success: "Account created! Please check your email to verify." 
      });
      // Or redirect to a "check email" page
    } catch (err) {
      console.error(err);
      if (err.code === "ER_DUP_ENTRY") {
        errors.push("Email already registered.");
        return res.render("signup", { errors });
      }
      res.status(500).send("Error creating account");
    }
  },

 // New: Verify email
  verifyEmail: async (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).send("Invalid token");

    try {
      const decoded = jwt.verify(token, process.env.VERIFICATION_SECRET || process.env.JWT_SECRET);
      await User.verifyUser(decoded.email);
      res.send("Email verified successfully! You can now <a href='/login'>login</a>.");
    } catch (err) {
      res.status(400).send("Invalid or expired token.");
    }
  },

  // (login method remains mostly unchanged; you can optionally add MX check here too)
  login: async (req, res) => {
    const { email, password } = req.body;
    const errors = [];

    if (!email || !validateEmailFormat(email)) {
      errors.push("Please provide a valid email address.");
    }
    if (!password) {
      errors.push("Password is required.");
    }

    if (errors.length > 0) {
      return res.render("login", { errors, email });
    }
    try {
      const user = await User.findByEmail(email);
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.render("login", { errors: ["Invalid email or password"], email });
      }

      const token = jwt.sign(
        {
          id: user.id,
          name: user.name,
          email: user.email,
          shipping_address: user.shipping_address,
          shipping_city: user.shipping_city,
          shipping_state: user.shipping_state,
          shipping_zip: user.shipping_zip,
          shipping_country: user.shipping_country,
        },
        process.env.JWT_SECRET,
        { expiresIn: "24h" }
      );

      res.cookie("token", token, { httpOnly: true });
      res.redirect("/products/catalogue");
    } catch (err) {
      console.error(err);
      res.status(500).render("login", { errors: ["Server error. Please try again."] });
    }
  },

  logout: (req, res) => {
    res.clearCookie("token");
    res.redirect("/");
  },
};

module.exports = authController;