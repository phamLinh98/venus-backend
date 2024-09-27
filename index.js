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
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

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

app.post("/api/find-user", async (req, res) => {
  const { namelogin, password } = req.body;
  try {
    const { data, error } = await supabase
      .from("info")
      .select("*")
      .eq("namelogin", namelogin)
      .eq("password", password);
    if (error) {
      return res
        .status(500)
        .json({ message: "Lỗi truy vấn cơ sở dữ liệu", error });
    }

    if (data.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy user" });
    }

    // Trả về thông tin user nếu tìm thấy
    res.status(200).json(data[0]);
  } catch (err) {
    res.status(500).json({ message: "Lỗi máy chủ", err });
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

// API để nhận 2 namelogin và trả về contents tương ứng nếu cả 2 tồn tại trong mảng user
app.post('/api/get-chat-double-user', async (req, res) => {
  const { namelogin1, namelogin2 } = req.body;

  if (!namelogin1 || !namelogin2) {
      return res.status(400).json({ error: 'Both namelogin1 and namelogin2 are required' });
  }

  try {
      // Lấy dữ liệu từ bảng chat trên Supabase
      const { data, error } = await supabase
          .from('chat') // Tên bảng của bạn
          .select('*');

      if (error) {
          return res.status(500).json({ error: 'Error fetching data from Supabase' });
      }

      // Tìm dữ liệu chat có chứa cả 2 namelogin trong mảng user
      const chatData = data.find(chat => chat.user.includes(namelogin1) && chat.user.includes(namelogin2));

      if (!chatData) {
          return res.status(404).json({ error: 'One or both users not found in chat' });
      }

      // Trả về contents tương ứng với cả 2 người dùng
      const filteredContents = chatData.contents.filter(
          content => content.name === namelogin1 || content.name === namelogin2
      );

      res.json({ contents: filteredContents });
  } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
  }
});


app.listen(port, () => {
  console.log(`API is running on http://localhost:${port}`);
});
