const express = require("express");
const multer = require("multer");
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const bodyParser = require('body-parser');
const path = require("path");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 8000;
const pdf = require("pdf-lib");
const { PDFDocument, Rectangle } = pdf;
const fs = require("fs");
const calculateHash = require("./calculateHash");
const web3i = require("./web3i");
const confirm = require("./confirm");
const QRCode = require("qrcode");
const { fromPath } = require("pdf2pic");
const { PNG } = require("pngjs");
const jsQR = require("jsqr");

var pdfBytes;
let detailsQR;

// Swagger setup
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Certificate API',
      version: '1.0.0',
      description: 'API documentation for Certificate module',
    },
    components: {
      schemas: {
        Certificate: {
          type: 'object',
          properties: {
            Certificate_Number: { type: 'string' },
            name: { type: 'string' },
            courseName: { type: 'string' },
            Grant_Date: { type: 'string' },
            Expiration_Date: { type: 'string' },
          },
          required: ['Certificate_Number', 'name', 'courseName', 'Grant_Date', 'Expiration_Date'],
        },
        DetailsQR: {
          type: 'object',
          properties: {
            Transaction_Hash: { type: 'string' },
            Certificate_Hash: { type: 'string' },
            Certificate_Number: { type: 'string' },
            Name: { type: 'string' },
            Course_Name: { type: 'string' },
            Grant_Date: { type: 'string' },
            Expiration_Date: { type: 'string' },
          },
        },
      },
    },
  },
  apis: ['app.js'],
};


const swaggerSpec = swaggerJsdoc(swaggerOptions);

function extractCertificateInfo(qrCodeText) {
  const lines = qrCodeText.split("\n");
  const certificateInfo = {
    "Certificate Hash": "",
    "Certificate Number": "",
  };

  for (const line of lines) {
    const parts = line.trim().split(":");
    if (parts.length === 2) {
      const key = parts[0].trim();
      let value = parts[1].trim();

      value = value.replace(/,/g, "");

      if (key === "Certificate Hash") {
        certificateInfo["Certificate Hash"] = value;
      } else if (key === "Certificate Number") {
        certificateInfo["Certificate Number"] = value;
      }
    }
  }

  return certificateInfo;
}

// Function to extract QR code from a PDF
async function extractQRCodeDataFromPDF(pdfFilePath) {
  try {
    const pdf2picOptions = {
      quality: 100,
      density: 300,
      format: "png",
      width: 2000,
      height: 2000,
    };

    const base64Response = await fromPath(pdfFilePath, pdf2picOptions)(
      1,
      true
    );
    const dataUri = base64Response?.base64;

    if (!dataUri)
      throw new Error("PDF could not be converted to Base64 string");

    const buffer = Buffer.from(dataUri, "base64");
    const png = PNG.sync.read(buffer);

    const code = jsQR(Uint8ClampedArray.from(png.data), png.width, png.height);
    const qrCodeText = code?.data;

    if (!qrCodeText)
      throw new Error("QR Code Text could not be extracted from PNG image");

    console.log("QR Code Text:==> ", qrCodeText);

    detailsQR = qrCodeText;

    const certificateInfo = extractCertificateInfo(qrCodeText);

    return certificateInfo;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

app.use(cors());
app.use(bodyParser.json());

// Set up multer storage and file filter
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads");
  },
  filename: (req, file, cb) => {
    const Certificate_Number = req.body.Certificate_Number;
    cb(null, file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(
      new Error("Invalid file type. Only JPEG and PNG files are allowed."),
      false
    );
  }
};

const upload = multer({ storage, fileFilter });

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get("/", (req, res) => {
  res.redirect("/api-docs");
});

/**
 * @swagger
 * tags:
 *   - name: Issuer
 *     description: APIs for issuing certificates
 *   - name: Verifier
 *     description: APIs for verifying certificates
 */

/**
 * @swagger
 * /api/issue:
 *   post:
 *     summary: Issue a certificate
 *     tags: [Issuer]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Certificate'
 *     responses:
 *       200:
 *         description: Certificate issued successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 qrCodeImage:
 *                   type: string
 *                   description: Base64-encoded PNG image of the QR code
 *                 polygonLink:
 *                   type: string
 *                   description: Polygon link for the certificate transaction
 *                 details:
 *                   $ref: '#/components/schemas/DetailsQR'
 *       400:
 *         description: Certificate already issued or other error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */

app.post("/api/issue", async (req, res) => {
  const Certificate_Number = req.body.Certificate_Number;
  const name = req.body.name;
  const courseName = req.body.courseName;
  const Grant_Date = req.body.Grant_Date;
  const Expiration_Date = req.body.Expiration_Date;

  const fields = {
    Certificate_Number: Certificate_Number,
    name: name,
    courseName: courseName,
    Grant_Date: Grant_Date,
    Expiration_Date: Expiration_Date,
  };
  const hashedFields = {};
  for (const field in fields) {
    hashedFields[field] = calculateHash(fields[field]);
  }
  const combinedHash = calculateHash(JSON.stringify(hashedFields));

  // Blockchain processing.
  const contract = await web3i();

  const val = await contract.methods.verifyCertificate(combinedHash).call();

  if (val[0] == true && val[1] == Certificate_Number) {
    res.status(400).json({ message: "Certificate already issued" });
  } else {
    const tx = contract.methods.issueCertificate(
      Certificate_Number,
      combinedHash
    );

    hash = await confirm(tx);

    const qrCodeData = `Transaction Hash: "${hash}",
Certificate Hash: ${combinedHash},
Certificate Number: ${Certificate_Number},
Name: ${name},
Course Name: ${courseName},
Grant Date: ${Grant_Date},
Expiration Date: ${Expiration_Date}`;

    const qrCodeImage = await QRCode.toDataURL(qrCodeData, {
      errorCorrectionLevel: "H",
    });

    const polygonLink = `https://polygonscan.com/tx/${hash}`;

    const certificateData = {
      Transaction_Hash: hash,
      Certificate_Hash: combinedHash,
      Certificate_Number: Certificate_Number,
      Name: name,
      Course_Name: courseName,
      Grant_Date: Grant_Date,
      Expiration_Date: Expiration_Date,
    };

    res.status(200).json({
      qrCodeImage: qrCodeImage,
      polygonLink: polygonLink,
      details: certificateData,
    });
  }
});

/**
 * @swagger
 * /api/verify:
 *   post:
 *     summary: Verify a certificate
 *     tags: [Verifier]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               pdfFile:
 *                 type: string
 *                 format: binary
 *                 description: PDF file containing the certificate to be verified.
 *     responses:
 *       200:
 *         description: Certificate verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Verification result message
 *                 detailsQR:
 *                   $ref: '#/components/schemas/DetailsQR'
 *       400:
 *         description: Certificate is not valid or other error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */

app.post("/api/verify", upload.single("pdfFile"), async (req, res) => {
  const file = req.file.path;

  try {
    const certificateData = await extractQRCodeDataFromPDF(file);
    console.log("Certificate Hash:", certificateData["Certificate Hash"]);
    console.log("Certificate Number:", certificateData["Certificate Number"]);

    const contract = await web3i();
    const certificateNumber = Number(certificateData["Certificate Number"]);
    const val = await contract.methods
      .verifyCertificate(certificateData["Certificate Hash"])
      .call();

    const isCertificateValid = val[0] == true && val[1] == certificateNumber;
    const message = isCertificateValid
      ? "Verified: Certificate is valid"
      : "Certificate is not valid";

    const verificationResponse = {
      message: message,
      detailsQR: detailsQR,
    };

    res.status(isCertificateValid ? 200 : 400).json(verificationResponse);
  } catch (error) {
    const verificationResponse = {
      message: "Certificate is not valid",
      detailsQR: detailsQR,
    };

    res.status(400).json(verificationResponse);
  }
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
