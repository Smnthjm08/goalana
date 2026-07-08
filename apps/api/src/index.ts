import express from "express"
import cors from "cors"

const app = express();
const port = 8080

app.use(express.json());
app.use(cors({ origin: "http://localhost:3000" }))

app.get("/", async (req, res) => {
  res.json({ status: "healthy!" })
})

app.listen(port, () => {
  console.log(`Listening on port ${port}...`)
})
