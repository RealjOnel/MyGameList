import mongoose from "mongoose";

// 1️⃣ Verbinde mit der DB (DB-Name direkt in der URI angeben)
const MONGO_URI = "mongodb+srv://myygameelistt_db_user:c9GuX30mBMPhKItc@userdb.f6mfzvy.mongodb.net/UserDB?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB: UserDB"))
  .catch(err => {
    console.error("❌ MongoDB Fehler:", err);
    process.exit(1);
  });

// 2️⃣ Einfaches User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  email: String,
  password: String
});

const User = mongoose.model("User", userSchema);

// 3️⃣ Test-User speichern, vorher löschen wenn schon vorhanden
async function addTestUser() {
  try {
    // Alte Testuser löschen, damit kein Duplicate-Key Fehler
    await User.deleteOne({ username: "testuser" });

    const testUser = new User({
      username: "testuser",
      email: "test@example.com",
      password: "1234"
    });

    const savedUser = await testUser.save();
    console.log("✅ Test-User gespeichert:", savedUser);
  } catch (err) {
    console.error("❌ Fehler beim Speichern:", err);
  } finally {
    mongoose.connection.close();
  }
}

addTestUser();
