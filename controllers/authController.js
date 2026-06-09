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

// Alternative: Flexible email validation (MX check is now optional/fallback)
const validateEmailDomainAndUser = async (email) => {
  try {
    const [localPart, domain] = email.split("@");
    
    if (!localPart || localPart.length < 1 || localPart.length > 64) {
      return { valid: false, message: "Invalid username part in email" };
    }

    // Basic username validation
    const localRe = /^[a-zA-Z0-9._%+-]+$/;
    if (!localRe.test(localPart)) {
      return { valid: false, message: "Email username contains invalid characters" };
    }

    // MX Record check (non-blocking in dev / when DNS fails)
    try {
      const mxRecords = await dns.resolveMx(domain);
      if (!mxRecords || mxRecords.length === 0) {
        console.warn(`No MX records found for ${domain} (email may still be valid)`);
        // Continue anyway - many legitimate domains have transient DNS issues
      } else {
        console.log(`✅ Valid MX records found for ${domain}`);
      }
    } catch (mxErr) {
      // ECONNREFUSED, timeout, etc. → log but allow signup in dev
      console.warn(`MX check skipped for ${email}: ${mxErr.message}. Proceeding with basic validation.`);
      // In production you could make this stricter if needed
    }

    return { valid: true };
  } catch (err) {
    console.error(`Email validation failed for ${email}:`, err.message);
    // Fallback: still allow if format is good (safer for localhost/dev)
    return { valid: true, warning: "Email domain check skipped" };
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
      const emailCheck = await validateEmailDomainAndUser(email);
      if (!emailCheck.valid) {
        errors.push(emailCheck.message);
      }
      // Optional: show warning but continue
      // if (emailCheck.warning) console.log(emailCheck.warning);
    }

    if (!password || !validatePassword(password)) {
      errors.push("Password must be at least 6 characters long.");
    }

    if (errors.length > 0) {
      return res.render("signup", { errors, name, email });
    }



    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Create user (unverified)
      await User.createWithVerification(name, email, hashedPassword);

      // Generate token
      const verificationToken = jwt.sign(
        { email },
        process.env.VERIFICATION_SECRET || process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Send email (critical part)
      await sendVerificationEmail(email, verificationToken);

      // Success with flash-style message
      return res.render("signup", { 
        success: "Account created successfully! A verification email has been sent to your inbox. Please verify to login." 
      });
    } catch (err) {
      console.error("Signup error:", err);
      
      if (err.code === "ER_DUP_ENTRY") {
        return res.render("signup", { errors: ["Email already registered."] });
      }
      
      // If email sending failed specifically
      if (err.message.includes('Failed to send verification email')) {
        return res.render("signup", { 
          errors: ["Account created but verification email failed to send. Please contact support or try again."] 
        });
      }
      
      res.status(500).render("signup", { errors: ["Server error. Please try again."] });
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