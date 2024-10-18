import express from "express";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";

const app = express();
app.use(express.json());
const port = 5000;

const httpServer = http.createServer(app);

//config info from environment
const supabaseUrl = process.env.SUPBASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// CORS what domain can connect and call to api
const corsOptions = {
  origin: ["https://linhthusinh.vercel.app", "http://localhost:5173"],
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));
// Allow call api with body form-data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
const getCurrentTimeInSeconds = () => Math.floor(Date.now() / 1000);

const io = new Server(httpServer, {
  cors: {
    origin: "*", // Chấp nhận tất cả domain (có thể điều chỉnh theo domain của bạn)
  },
});
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

// check and get login user infomation
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

// adding new user to list member (sigin)
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

// get list data chat of all users
app.get("/api/chat", async (req, res) => {
  try {
    const { data, error } = await supabase.from("chat").select("*").order("id");
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//Thêm mới bản ghi cho contents chat giữa 2 user
app.post("/api/add-chat", async (req, res) => {
  const { id, userIdSending, avatar, name, content, userClick, userIdSendingOther } = req.body;

  try {
    // Check if the chat with the given ID exists
    const { data: chatData, error } = await supabase
      .from("chat")
      .select("*")
      .eq("id", id);

    if (error) {
      return res.status(500).json({ error: "Error fetching chat data" });
    }

    // Prepare the new content record
    const createContentRecord = (key, recordName, recordContent, userIdSending) => {
      const record = {
        id: id,
        key: key,
        name: recordName,
        time: getCurrentTimeInSeconds(),
        liked: false,
        avatar: avatar,
        content: recordContent || null,
        userIdSending: userIdSending
      };
  
      return record;
    };

    let updatedContents = [];

    // If the chat does not exist, create a new record
    if (!chatData || chatData.length === 0) {
      // Create the new chat record
      const newChat = {
        id: id,
        user: [name, userClick],
        contents: [],
      };

      // Insert the new chat record
      const { error: insertError } = await supabase
        .from("chat")
        .insert([newChat]);

      if (insertError) {
        return res
          .status(500)
          .json({ error: "Error creating new chat record" });
      }

      // Create the initial content records
      updatedContents.push(createContentRecord(1, name, content, userIdSending));
      updatedContents.push(createContentRecord(2, userClick, null, userIdSendingOther));

      // Update the chat with the new content records
      const { error: updateContentsError } = await supabase
        .from("chat")
        .update({ contents: updatedContents })
        .eq("id", id);

      if (updateContentsError) {
        return res.status(500).json({ error: "Error updating chat contents" });
      }

      return res.status(201).json({
        contents: {
          id: id,
          user: [name, userClick],
          contents: updatedContents,
        },
      });
    }

    // If the chat exists, check if the combination of name and userClick already exists in the user array
    const existingUsers = chatData[0].user;
    const hasExistingUsers =
      existingUsers.includes(name) && existingUsers.includes(userClick);

    // If the user combination is not present, add them to the chat's user list
    if (!hasExistingUsers) {
      const updatedUserArray = [...existingUsers, name, userClick];

      const { error: userUpdateError } = await supabase
        .from("chat")
        .update({ user: updatedUserArray })
        .eq("id", id);

      if (userUpdateError) {
        return res
          .status(500)
          .json({ error: "Error updating user list in chat" });
      }
    }

    // Continue with updating contents
    const currentContents = chatData[0].contents;
    const newRecord = createContentRecord(currentContents.length + 1, name, content);
    updatedContents = [...currentContents, newRecord];

    // Add an additional record if the contents were originally empty and name matches
    if (currentContents.length === 0 && name === newRecord.name) {
      const additionalRecord = createContentRecord(updatedContents.length + 1, userClick, null);
      updatedContents.push(additionalRecord);
    }

    const { error: updateError } = await supabase
      .from("chat")
      .update({ contents: updatedContents })
      .eq("id", id);

    if (updateError) {
      return res.status(500).json({ error: "Error updating chat contents" });
    }

    return res.status(200).json({ updatedContents });
  } catch (error) {
    console.error("Error adding chat:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// get list data user name is chatting with login user
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

// get chat content from login user and clicked user (click from dashboard and show in message)
app.post("/api/get-chat-double-user", async (req, res) => {
  const { namelogin1, namelogin2 } = req.body;

  if (!namelogin1 || !namelogin2) {
    return res
      .status(400)
      .json({ error: "Both namelogin1 and namelogin2 are required" });
  }

  try {
    // Lấy dữ liệu từ bảng chat trên Supabase
    const { data, error } = await supabase
      .from("chat") // Tên bảng của bạn
      .select("*");

    if (error) {
      return res
        .status(500)
        .json({ error: "Error fetching data from Supabase" });
    }

    // Tìm dữ liệu chat có chứa cả 2 namelogin trong mảng user
    const chatData = data.find(
      (chat) => chat.user.includes(namelogin1) && chat.user.includes(namelogin2)
    );

    console.log("chatData :>> ", chatData);

    if (!chatData) {
      return res
        .status(404)
        .json({ error: "One or both users not found in chat" });
    }

    // Trả về contents tương ứng với cả 2 người dùng
    // const filteredContents = chatData.contents.filter(
    //   (content) => content.name === namelogin1 || content.name === namelogin2
    // );

    res.json(chatData);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// update liked in chat when user click

app.post("/api/update-liked", async (req, res) => {
  const { namelogin1, namelogin2, key, liked } = req.body;

  // Kiểm tra input hợp lệ
  if (!namelogin1 || !namelogin2 || key === undefined || liked === undefined) {
    return res.status(400).json({
      error: "Both namelogin1, namelogin2, key, and liked are required",
    });
  }

  try {
    // Lấy dữ liệu từ bảng chat trên Supabase
    const { data, error } = await supabase
      .from("chat") // Tên bảng của bạn
      .select("*");

    if (error) {
      return res
        .status(500)
        .json({ error: "Error fetching data from Supabase" });
    }

    // Tìm dữ liệu chat có chứa cả 2 namelogin trong mảng user
    const chatData = data.find(
      (chat) => chat.user.includes(namelogin1) && chat.user.includes(namelogin2)
    );

    console.log("chatData :>> ", chatData);

    if (!chatData) {
      return res
        .status(404)
        .json({ error: "One or both users not found in chat" });
    }

    // Tìm message với key tương ứng
    const contentIndex = chatData.contents.findIndex(
      (item) => item.key === Number(key)
    );
    if (contentIndex === -1) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Đảo ngược giá trị liked cho nội dung tương ứng với key
    chatData.contents[contentIndex].liked =
      !chatData.contents[contentIndex].liked;

    // Cập nhật lại dữ liệu trong Supabase
    const { error: updateError } = await supabase
      .from("chat")
      .update({ contents: chatData.contents })
      .eq("id", chatData.id);

    if (updateError) {
      return res.status(500).json({ error: "Error updating liked status" });
    }

    // Trả về dữ liệu contents với liked đã được đảo ngược
    const filteredContents = chatData.contents.filter(
      (content) => content.name === namelogin1 || content.name === namelogin2
    );

    const itemWithKey1 = filteredContents.find(
      (item) => item.key === Number(key)
    );
    console.log("itemWithKey1 :>> ", itemWithKey1);

    res.json(itemWithKey1);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

supabase
  .channel("realtime:public:chat")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "chat" },
    (payload) => {
      console.log("Chat data changed:", payload);

      // Gửi dữ liệu mới qua WebSocket cho tất cả các client đã kết nối
      io.emit("chatUpdated", payload.new);
    }
  )
  .subscribe();

// Lắng nghe các client kết nối
io.on("connection", (socket) => {
  console.log("Client connected");

  // Bạn có thể lắng nghe thêm các sự kiện từ client ở đây
  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

httpServer.listen(port, () => {
  console.log(`API is running on http://localhost:${port}`);
});
