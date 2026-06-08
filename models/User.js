const db = require("../config/db");
const bcrypt = require("bcryptjs");

const User = {
  create: async (name, email, password) => {
    const hashedPassword = await bcrypt.hash(password, 10);
    return new Promise((resolve, reject) => {
      db.query(
        "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
        [name, email, hashedPassword],
        (err, result) => {
          if (err) reject(err);
          resolve(result);
        },
      );
    });
  },

  findByEmail: (email) => {
    return new Promise((resolve, reject) => {
      db.query(
        "SELECT * FROM users WHERE email = ?",
        [email],
        (err, results) => {
          if (err) reject(err);
          resolve(results[0]);
        },
      );
    });
  },

  findById: (id) => {
    return new Promise((resolve, reject) => {
      db.query(
        `SELECT id, name, email, shipping_address, shipping_city, 
                shipping_state, shipping_zip, shipping_country, created_at 
         FROM users WHERE id = ?`,
        [id],
        (err, results) => {
          if (err) reject(err);
          resolve(results[0]);
        }
      );
    });
  },

    // Add this method
  updateProfile: (id, name, email, shipping_address, shipping_city, shipping_state, shipping_zip, shipping_country) => {
    return new Promise((resolve, reject) => {
      db.query(
        `UPDATE users SET name = ?, email = ?, shipping_address = ?, 
         shipping_city = ?, shipping_state = ?, shipping_zip = ?, shipping_country = ? 
         WHERE id = ?`,
        [name, email, shipping_address, shipping_city, shipping_state, shipping_zip, shipping_country, id],
        (err, result) => {
          if (err) reject(err);
          resolve(result);
        }
      );
    });
  },

  // Optional: Update password separately
  updatePassword: async (id, newPassword) => {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    return new Promise((resolve, reject) => {
      db.query(
        "UPDATE users SET password = ? WHERE id = ?",
        [hashedPassword, id],
        (err, result) => {
          if (err) reject(err);
          resolve(result);
        }
      );
    });
  },


    createWithVerification: async (name, email, hashedPassword) => {
    return new Promise((resolve, reject) => {
      db.query(
        "INSERT INTO users (name, email, password, is_verified) VALUES (?, ?, ?, ?)",
        [name, email, hashedPassword, false],
        (err, result) => {
          if (err) reject(err);
          resolve(result);
        }
      );
    });
  },

  verifyUser: (email) => {
    return new Promise((resolve, reject) => {
      db.query(
        "UPDATE users SET is_verified = true WHERE email = ?",
        [email],
        (err, result) => {
          if (err) reject(err);
          resolve(result);
        }
      );
    });
  },

  // In findByEmail / login, add check if needed:
  // if (!user.is_verified) throw new Error("Email not verified");

  // In findByEmail / login, add check if needed:
  // if (!user.is_verified) throw new Error("Email not verified");
};
module.exports = User;
