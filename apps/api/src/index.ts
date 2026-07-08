import express from "express"
import cors from "cors"
import { TXLINE_ENV } from "@workspace/txline"

const app = express();
const port = 8080

app.use(express.json());
app.use(cors({ origin: "http://localhost:3000" }))

console.log("TXLINE_ENV", TXLINE_ENV);

app.get("/", async (req, res) => {
  res.json({ status: "healthy!" })
})

// app.post("/api/v1/admin/txline/activate", async (req, res) => {
//   try {
//     const { txSig, walletSignature, leagues } = req.body;
//     console.log("tx", txSig)
//     console.log("wallet", walletSignature)
//     console.log("leagues", leagues)


//     return res.json({ result })
//   } catch (error) {
//     console.log(">>>> error! ", error);
//     return res.status(500).json({ error })
//   }
// })

app.listen(port, () => {
  console.log(`Listening on port ${port}...`)
})
