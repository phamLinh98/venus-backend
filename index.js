import express from "express";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
import cors from "cors";

const app = express();
app.use(express.json());
const port = 5000;

const supabaseUrl = process.env.SUPBASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const corsOptions = {
  origin: ["https://linhthusinh.vercel.app", "http://localhost:5173"],
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// get list data info from supabase
app.get("/api/info", async (req, res) => {
  try {
    const { data, error } = await supabase.from("info").select("*");
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    const result = data.map((user) => ({
      id: user.id,
      namelogin: user.namelogin,
      nameshow: user.nameshow,
      email: user.email,
      avatar: user.avatar,
      department: user.department,
      job: user.job,
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// add new records to info
app.post("/api/info", async (req, res) => {
  const { id, namelogin, nameshow, email, avatar, department, password, job } =
    req.body;

  const { data, error } = await supabase
    .from("info") // Tên bảng của bạn
    .insert([
      { id, namelogin, nameshow, email, avatar, department, password, job },
    ]);

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.status(200).json(data);
});

app.get("/api/chat", async (req, res) => {
  try {
    const { data, error } = await supabase.from("chat").select("*");
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/chat-follow-namelogin", async (req, res) => {
  try {
    const namelogin = req.headers.namelogin; // Get namelogin from headers

    if (!namelogin) {
      return res.status(400).json({ error: "namelogin is required" });
    }

    // Perform the query and filter for records where `user` contains `namelogin`
    const { data, error } = await supabase
      .from("chat")
      .select("*")
      .or(`user->>0.ilike.${namelogin},user->>1.ilike.${namelogin}`); // Correct JSON querying

    if (error) {
      return res.status(500).json({ error: error.message });
    }
    // Return the found records
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});


app.listen(port, () => {
  console.log(`API is running on http://localhost:${port}`);
});
