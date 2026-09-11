"use client";

import "./tenant-application.css";
import "./tenant-share.css";
import { FormEvent, PointerEvent, useEffect, useRef, useState } from "react";
import {
  PDFDocument,
  PDFFont,
  PDFImage,
  PDFPage,
  StandardFonts,
  rgb,
} from "pdf-lib";

type Kind = "individual" | "juristic";

export default function TenantApplicationPortal({
  agent,
}: {
  agent: { email: string; name: string; property: string };
}) {
  const [kind, setKind] = useState<Kind | null>(null),
    [sending, setSending] = useState(false),
    [sent, setSent] = useState(false),
    [error, setError] = useState(""),
    [applicationPdf, setApplicationPdf] = useState<File | null>(null),
    [signature, setSignature] = useState("");
  const shareApplication = async () => {
    if (!applicationPdf) return;
    try {
      await navigator.clipboard?.writeText(agent.email);
      const files = [applicationPdf];
      if (navigator.share && navigator.canShare?.({ files }))
        await navigator.share({
          title: `Tenant application - ${agent.property || "Pam Golding"}`,
          text: `Completed application for ${agent.property || "the rental property"}. Please send to ${agent.name}: ${agent.email}`,
          files,
        });
      else throw new Error("share-unavailable");
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      window.location.href = `mailto:${encodeURIComponent(agent.email)}?subject=${encodeURIComponent(`Tenant application - ${agent.property || "property"}`)}&body=${encodeURIComponent(`Dear ${agent.name},\n\nPlease find my completed tenant application attached.\n\nThe agent email address has been copied. Please attach the downloaded combined PDF before sending.`)}`;
    }
  };
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    if (!signature) {
      setError("Please sign inside the signature box using your finger.");
      return;
    }
    setSending(true);
    const form = new FormData(e.currentTarget);
    try {
      const applicant = String(
          form.get(kind === "individual" ? "fullName" : "entityName") ||
            "Tenant",
        ),
        pdfBytes = await createCombinedPdf(
          form,
          kind || "individual",
          agent,
          signature,
        ),
        pdfBuffer = Uint8Array.from(pdfBytes).buffer,
        pdf = new File(
          [pdfBuffer],
          `Pam-Golding-complete-application-${safeFilename(applicant)}.pdf`,
          { type: "application/pdf" },
        );
      setApplicationPdf(pdf);
      setSent(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The combined PDF could not be prepared. Please try again.",
      );
    } finally {
      setSending(false);
    }
  };
  if (sent)
    return (
      <main className="application-shell">
        <section className="application-card application-success">
          <img src="/pam-golding-gate.jpg?v=7" alt="Pam Golding Properties" />
          <h1>Application ready to send</h1>
          <p>
            Your application, signature and all supporting documents are
            combined into one PDF.
          </p>
          <div className="application-recipient">
            <span>Send to</span>
            <strong>{agent.name}</strong>
            <a href={`mailto:${agent.email}`}>{agent.email}</a>
          </div>
          {applicationPdf && (
            <button
              className="application-submit"
              onClick={() => downloadFile(applicationPdf)}
            >
              1. Download complete application PDF
            </button>
          )}
          <button
            className="application-submit secondary-share"
            onClick={shareApplication}
          >
            2. Share application via email
          </button>
          <a
            className="official-form"
            href={`mailto:${encodeURIComponent(agent.email)}?subject=${encodeURIComponent(`Tenant application - ${agent.property || "property"}`)}`}
          >
            Or open email to {agent.name}
          </a>
          <small>
            Only one file needs to be attached: the downloaded complete
            application PDF.
          </small>
        </section>
      </main>
    );
  return (
    <main className="application-shell">
      <section className="application-card">
        <header className="application-brand">
          <img src="/pam-golding-gate.jpg?v=7" alt="Pam Golding Properties" />
          <strong>Pam Golding</strong>
          <span>PROPERTIES · RENTALS</span>
        </header>
        {!kind ? (
          <section className="application-intro">
            <h1>Thank you for your interest in renting a property from us.</h1>
            <p>
              {agent.property && (
                <>
                  Property: <b>{agent.property}</b>
                  <br />
                </>
              )}
              Please choose how you will be applying.
            </p>
            <div className="application-options">
              <button onClick={() => setKind("individual")}>
                Apply in my personal capacity
              </button>
              <button onClick={() => setKind("juristic")}>
                Apply in a business name
              </button>
            </div>
          </section>
        ) : (
          <form className="application-form" onSubmit={submit}>
            <button
              type="button"
              className="official-form"
              onClick={() => setKind(null)}
            >
              ← Change application type
            </button>
            <h1>
              {kind === "individual"
                ? "Individual tenant application"
                : "Juristic entity tenant application"}
            </h1>
            <p>
              All fields and supporting documents are compulsory. When finished,
              one complete PDF will be prepared to send to <b>{agent.name}</b>.
            </p>
            {kind === "individual" ? (
              <IndividualFields property={agent.property} />
            ) : (
              <JuristicFields property={agent.property} />
            )}
            <SignaturePad value={signature} onChange={setSignature} />
            {error && <p className="application-error">{error}</p>}
            <button className="application-submit" disabled={sending}>
              {sending
                ? "Combining application and documents..."
                : "Submit complete application"}
            </button>
            <a
              className="official-form"
              href={
                kind === "individual"
                  ? "/forms/tenant-application-individual.pdf"
                  : "/forms/tenant-application-juristic.pdf"
              }
              target="_blank"
            >
              View the official Pam Golding form and terms
            </a>
          </form>
        )}
      </section>
    </main>
  );
}

function safeFilename(value: string) {
  return (
    value
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-|-$/g, "") || "tenant"
  );
}
function fieldLabel(value: string) {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase());
}
const sections: Record<Kind, Array<[string, string[]]>> = {
  individual: [
    [
      "Property and occupation",
      ["premises", "monthlyRental", "occupationFrom", "occupationTo"],
    ],
    [
      "Applicant details",
      [
        "fullName",
        "cellphone",
        "email",
        "idNumber",
        "dateOfBirth",
        "saCitizen",
        "residencePermit",
        "sequestrated",
        "maritalStatus",
        "presentAddress",
        "addressPeriod",
        "currentRental",
      ],
    ],
    [
      "Employment and income",
      [
        "employmentType",
        "employer",
        "employerAddress",
        "position",
        "employmentPeriod",
        "employerContact",
        "employerEmail",
        "monthlyIncome",
        "otherIncome",
      ],
    ],
    [
      "Household and references",
      [
        "spouseDetails",
        "nearestRelative",
        "relativeContact",
        "occupantCount",
        "occupants",
        "petCount",
        "petBreeds",
        "landlordReference",
        "landlordReferenceContact",
        "employerReference",
        "employerReferenceContact",
        "marketingSource",
      ],
    ],
    ["Consent and signature", ["signature", "signatureDate", "consent"]],
  ],
  juristic: [
    [
      "Property and occupation",
      ["premises", "monthlyRental", "occupationFrom", "occupationTo"],
    ],
    [
      "Entity details",
      [
        "entityName",
        "registrationNumber",
        "registeredAddress",
        "entityType",
        "directors",
        "accountantName",
        "accountantContact",
        "accountantEmail",
        "tradeReferences",
      ],
    ],
    [
      "Authorised signatory",
      [
        "signatoryName",
        "signatoryId",
        "signatoryCapacity",
        "signatoryCell",
        "signatoryEmail",
      ],
    ],
    [
      "Occupants",
      [
        "occupantCount",
        "occupants",
        "petCount",
        "petBreeds",
        "marketingSource",
      ],
    ],
    ["Consent and signature", ["signature", "signatureDate", "consent"]],
  ],
};
function cleanPdfText(value: string) {
  return value.normalize("NFKD").replace(/[^\x20-\x7E]/g, " ");
}
function wrapText(value: string, font: PDFFont, size: number, width: number) {
  const words = cleanPdfText(value).split(/\s+/),
    lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = (line + " " + word).trim();
    if (line && font.widthOfTextAtSize(next, size) > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}
function SignaturePad({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    drawing = useRef(false);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1),
      rect = element.getBoundingClientRect();
    element.width = Math.round(rect.width * ratio);
    element.height = Math.round(rect.height * ratio);
    const context = element.getContext("2d");
    if (context) {
      context.scale(ratio, ratio);
      context.lineWidth = 2.2;
      context.lineCap = "round";
      context.strokeStyle = "#123c30";
    }
  }, []);
  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const start = (event: PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    drawing.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const context = event.currentTarget.getContext("2d"),
      p = point(event);
    context?.beginPath();
    context?.moveTo(p.x, p.y);
  };
  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    event.preventDefault();
    const context = event.currentTarget.getContext("2d"),
      p = point(event);
    context?.lineTo(p.x, p.y);
    context?.stroke();
  };
  const finish = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    event.preventDefault();
    drawing.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    onChange(event.currentTarget.toDataURL("image/png"));
  };
  const clear = () => {
    const element = canvas.current,
      context = element?.getContext("2d");
    if (element && context) {
      context.clearRect(0, 0, element.width, element.height);
      onChange("");
    }
  };
  return (
    <section className="signature-section">
      <h2>Draw your signature</h2>
      <p>Use your finger or stylus to sign inside the box.</p>
      <canvas
        ref={canvas}
        aria-label="Draw your signature here"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={finish}
      />
      <button type="button" onClick={clear}>
        Clear signature
      </button>
      <input type="hidden" name="drawnSignature" value={value} />
    </section>
  );
}
async function createCombinedPdf(
  form: FormData,
  kind: Kind,
  agent: { email: string; name: string; property: string },
  signature: string,
) {
  const pdf = await PDFDocument.create(),
    regular = await pdf.embedFont(StandardFonts.Helvetica),
    bold = await pdf.embedFont(StandardFonts.HelveticaBold),
    logoResponse = await fetch("/pam-golding-gate.jpg?v=7"),
    logo = logoResponse.ok
      ? await pdf.embedJpg(await logoResponse.arrayBuffer())
      : null,
    signatureImage = await pdf.embedPng(signature),
    green = rgb(0.035, 0.31, 0.25),
    gold = rgb(0.77, 0.64, 0.37),
    light = rgb(0.94, 0.97, 0.96);
  let page!: PDFPage,
    y = 0,
    pageNumber = 0;
  const newPage = () => {
    page = pdf.addPage([595.28, 841.89]);
    pageNumber++;
    page.drawRectangle({
      x: 0,
      y: 767,
      width: 595.28,
      height: 74,
      color: green,
    });
    if (logo) page.drawImage(logo, { x: 45, y: 779, width: 50, height: 50 });
    page.drawText("PAM GOLDING", {
      x: 112,
      y: 806,
      size: 19,
      font: bold,
      color: rgb(1, 1, 1),
    });
    page.drawText("PROPERTIES - RENTAL APPLICATION", {
      x: 112,
      y: 788,
      size: 9,
      font: regular,
      color: rgb(0.83, 0.9, 0.87),
    });
    page.drawText(`Page ${pageNumber}`, {
      x: 505,
      y: 788,
      size: 8,
      font: regular,
      color: rgb(0.83, 0.9, 0.87),
    });
    y = 742;
  };
  newPage();
  const ensure = (height: number) => {
    if (y - height < 52) newPage();
  };
  const section = (title: string) => {
    ensure(38);
    page.drawRectangle({
      x: 42,
      y: y - 24,
      width: 511,
      height: 28,
      color: light,
    });
    page.drawRectangle({ x: 42, y: y - 24, width: 5, height: 28, color: gold });
    page.drawText(title.toUpperCase(), {
      x: 58,
      y: y - 15,
      size: 11,
      font: bold,
      color: green,
    });
    y -= 39;
  };
  const field = (label: string, value: string) => {
    const lines = wrapText(value || "-", regular, 10, 475),
      height = 28 + Math.max(0, lines.length - 1) * 13;
    ensure(height);
    page.drawText(fieldLabel(label), {
      x: 48,
      y,
      size: 9,
      font: bold,
      color: green,
    });
    y -= 14;
    lines.forEach((line) => {
      page.drawText(line, {
        x: 58,
        y,
        size: 10,
        font: regular,
        color: rgb(0.12, 0.19, 0.17),
      });
      y -= 13;
    });
    page.drawLine({
      start: { x: 48, y: y + 5 },
      end: { x: 547, y: y + 5 },
      thickness: 0.45,
      color: rgb(0.84, 0.88, 0.86),
    });
    y -= 8;
  };
  section("Application overview");
  field(
    "Application type",
    kind === "individual" ? "Individual" : "Juristic entity",
  );
  field("Receiving agent", agent.name);
  field("Agent email", agent.email);
  field("Property", agent.property || String(form.get("premises") || ""));
  field("Prepared", new Date().toLocaleString("en-ZA"));
  for (const [title, keys] of sections[kind]) {
    section(title);
    for (const key of keys) field(key, String(form.get(key) || ""));
    if (title === "Consent and signature") {
      ensure(105);
      page.drawText("Handwritten signature", {
        x: 48,
        y,
        size: 9,
        font: bold,
        color: green,
      });
      page.drawRectangle({
        x: 48,
        y: y - 88,
        width: 250,
        height: 78,
        borderColor: rgb(0.72, 0.79, 0.76),
        borderWidth: 1,
        color: rgb(1, 1, 1),
      });
      page.drawImage(signatureImage, {
        x: 57,
        y: y - 80,
        width: 232,
        height: 62,
      });
      y -= 106;
    }
  }
  const files = [...form.entries()].filter(
    (entry): entry is [string, File] =>
      entry[1] instanceof File && entry[1].size > 0,
  );
  for (const [key, file] of files) {
    const bytes = await file.arrayBuffer();
    if (
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf")
    ) {
      const source = await PDFDocument.load(bytes),
        copied = await pdf.copyPages(source, source.getPageIndices());
      copied.forEach((copy, index) => {
        pdf.addPage(copy);
        copy.drawText(
          `Supporting document: ${fieldLabel(key)} - ${file.name} (${index + 1}/${copied.length})`,
          { x: 28, y: 18, size: 7, font: regular, color: green },
        );
      });
    } else {
      const image = await embedUploadedImage(pdf, file, bytes),
        documentPage = pdf.addPage([595.28, 841.89]),
        available = { width: 515, height: 745 },
        scale = Math.min(
          available.width / image.width,
          available.height / image.height,
          1,
        );
      documentPage.drawText(
        `SUPPORTING DOCUMENT - ${fieldLabel(key).toUpperCase()}`,
        { x: 40, y: 806, size: 11, font: bold, color: green },
      );
      documentPage.drawText(file.name, {
        x: 40,
        y: 788,
        size: 8,
        font: regular,
        color: rgb(0.3, 0.35, 0.33),
      });
      documentPage.drawImage(image, {
        x: (595.28 - image.width * scale) / 2,
        y: 32 + (745 - image.height * scale) / 2,
        width: image.width * scale,
        height: image.height * scale,
      });
    }
  }
  return await pdf.save();
}
async function embedUploadedImage(
  pdf: PDFDocument,
  file: File,
  bytes: ArrayBuffer,
): Promise<PDFImage> {
  if (file.type === "image/png" || file.name.toLowerCase().endsWith(".png"))
    return pdf.embedPng(bytes);
  if (file.type === "image/jpeg" || /\.jpe?g$/i.test(file.name))
    return pdf.embedJpg(bytes);
  const bitmap = await createImageBitmap(file),
    canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) =>
        value ? resolve(value) : reject(new Error("Unsupported image format")),
      "image/png",
    ),
  );
  bitmap.close();
  return pdf.embedPng(await blob.arrayBuffer());
}
function downloadFile(file: File) {
  const url = URL.createObjectURL(file),
    link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function IndividualFields({ property }: any) {
  const [selfEmployed, setSelfEmployed] = useState(false);
  return (
    <div className="application-grid">
      <h2>Property and occupation</h2>
      <label className="wide">
        Premises applied for
        <input name="premises" defaultValue={property} required />
      </label>
      <label>
        Monthly advertised rental
        <input name="monthlyRental" required />
      </label>
      <label>
        Occupation from
        <input name="occupationFrom" type="date" required />
      </label>
      <label>
        Occupation to
        <input name="occupationTo" type="date" required />
      </label>
      <h2>Applicant</h2>
      <label className="wide">
        Full names and surname
        <input name="fullName" required />
      </label>
      <label>
        Cellphone
        <input name="cellphone" type="tel" required />
      </label>
      <label>
        Email
        <input name="email" type="email" required />
      </label>
      <label>
        ID or passport number
        <input name="idNumber" required />
      </label>
      <label>
        Date of birth
        <input name="dateOfBirth" type="date" required />
      </label>
      <label>
        South African citizen?
        <select name="saCitizen" required>
          <option value="">Choose</option>
          <option>Yes</option>
          <option>No</option>
        </select>
      </label>
      <label>
        Residence permit number or N/A
        <input name="residencePermit" required />
      </label>
      <label>
        Sequestrated?
        <select name="sequestrated" required>
          <option value="">Choose</option>
          <option>No</option>
          <option>Yes</option>
        </select>
      </label>
      <label>
        Marital status
        <select name="maritalStatus" required>
          <option value="">Choose</option>
          <option>Single</option>
          <option>Married in community of property</option>
          <option>Married out of community of property</option>
          <option>Other</option>
        </select>
      </label>
      <label className="wide">
        Present residential address
        <textarea name="presentAddress" required />
      </label>
      <label>
        How long at this address?
        <input name="addressPeriod" required />
      </label>
      <label>
        Current monthly rental
        <input name="currentRental" required />
      </label>
      <h2>Employment and income</h2>
      <label>
        Employment type
        <select
          name="employmentType"
          required
          onChange={(e) => setSelfEmployed(e.target.value === "Self-employed")}
        >
          <option value="">Choose</option>
          <option>Employed</option>
          <option>Self-employed</option>
        </select>
      </label>
      <label>
        Employer or trading name
        <input name="employer" required />
      </label>
      <label className="wide">
        Employer/business address and nature of business
        <textarea name="employerAddress" required />
      </label>
      <label>
        Position
        <input name="position" required />
      </label>
      <label>
        Employment period
        <input name="employmentPeriod" required />
      </label>
      <label>
        Employer contact number
        <input name="employerContact" required />
      </label>
      <label>
        Employer email
        <input name="employerEmail" type="email" required />
      </label>
      <label>
        Monthly income
        <input name="monthlyIncome" required />
      </label>
      <label>
        Spouse/other monthly income or N/A
        <input name="otherIncome" required />
      </label>
      <h2>Household and references</h2>
      <label className="wide">
        Spouse name, ID and contact details or N/A
        <textarea name="spouseDetails" required />
      </label>
      <label>
        Nearest relative and relationship
        <input name="nearestRelative" required />
      </label>
      <label>
        Nearest relative contact number
        <input name="relativeContact" required />
      </label>
      <label>
        Number of occupants
        <input name="occupantCount" type="number" min="1" required />
      </label>
      <label className="wide">
        All occupants' names, ages and ID numbers
        <textarea name="occupants" required />
      </label>
      <label>
        Number of pets
        <input name="petCount" type="number" min="0" required />
      </label>
      <label>
        Pet breeds or N/A
        <input name="petBreeds" required />
      </label>
      <label>
        Present landlord/agent
        <input name="landlordReference" required />
      </label>
      <label>
        Landlord/agent contact
        <input name="landlordReferenceContact" required />
      </label>
      <label>
        Immediate superior reference
        <input name="employerReference" required />
      </label>
      <label>
        Immediate superior contact
        <input name="employerReferenceContact" required />
      </label>
      <label className="wide">
        How did you become aware of the premises?
        <select name="marketingSource" required>
          <option value="">Choose</option>
          <option>Website enquiry</option>
          <option>Approached or phoned PGP branch/agent</option>
          <option>Print advertisement</option>
          <option>To Let board</option>
          <option>Other</option>
        </select>
      </label>
      <div className="document-list">
        <h3>Required documents</h3>
        <label>
          ID/passport - front
          <input name="idFront" type="file" accept=".pdf,image/*" required />
        </label>
        <label>
          ID/passport - back
          <input name="idBack" type="file" accept=".pdf,image/*" required />
        </label>
        <label>
          Bank statements - {selfEmployed ? "six" : "three"} most recent months
          <input
            name="bankStatements"
            type="file"
            accept=".pdf,image/*"
            multiple
            required
          />
        </label>
        <label>
          Latest payslip {selfEmployed ? "or proof of income" : ""}
          <input name="payslip" type="file" accept=".pdf,image/*" required />
        </label>
      </div>
      <h2>Consent and signature</h2>
      <label className="wide">
        Electronic signature - type your full legal name
        <input name="signature" required />
      </label>
      <label>
        Signature date
        <input name="signatureDate" type="date" required />
      </label>
      <label className="wide consent">
        <input name="consent" type="checkbox" value="Accepted" required />
        <span>
          I confirm that the information is correct, I am 18 or older, I have
          contractual capacity, I am not under debt review, and I accept the
          consent, credit-check and application terms in the official Pam
          Golding form.
        </span>
      </label>
    </div>
  );
}

function JuristicFields({ property }: any) {
  return (
    <div className="application-grid">
      <h2>Property and occupation</h2>
      <label className="wide">
        Premises applied for
        <input name="premises" defaultValue={property} required />
      </label>
      <label>
        Monthly advertised rental
        <input name="monthlyRental" required />
      </label>
      <label>
        Occupation from
        <input name="occupationFrom" type="date" required />
      </label>
      <label>
        Occupation to
        <input name="occupationTo" type="date" required />
      </label>
      <h2>Entity details</h2>
      <label>
        Entity name
        <input name="entityName" required />
      </label>
      <label>
        Registration number
        <input name="registrationNumber" required />
      </label>
      <label className="wide">
        Registered office address
        <textarea name="registeredAddress" required />
      </label>
      <label>
        Entity type
        <select name="entityType" required>
          <option value="">Choose</option>
          <option>Company</option>
          <option>Close Corporation</option>
          <option>Trust</option>
        </select>
      </label>
      <label className="wide">
        All directors, members or trustees - full names and ID numbers
        <textarea name="directors" required />
      </label>
      <label>
        Auditor/accounting officer
        <input name="accountantName" required />
      </label>
      <label>
        Auditor/accounting officer contact
        <input name="accountantContact" required />
      </label>
      <label>
        Auditor/accounting officer email
        <input name="accountantEmail" type="email" required />
      </label>
      <label className="wide">
        Three trade references with contact details
        <textarea name="tradeReferences" required />
      </label>
      <h2>Authorised signatory</h2>
      <label>
        Full name
        <input name="signatoryName" required />
      </label>
      <label>
        ID/passport number
        <input name="signatoryId" required />
      </label>
      <label>
        Position/capacity
        <input name="signatoryCapacity" required />
      </label>
      <label>
        Cellphone
        <input name="signatoryCell" type="tel" required />
      </label>
      <label>
        Email
        <input name="signatoryEmail" type="email" required />
      </label>
      <h2>Occupants</h2>
      <label>
        Number of occupants
        <input name="occupantCount" type="number" min="1" required />
      </label>
      <label className="wide">
        All occupants' names, ages and ID numbers
        <textarea name="occupants" required />
      </label>
      <label>
        Number of pets
        <input name="petCount" type="number" min="0" required />
      </label>
      <label>
        Pet breeds or N/A
        <input name="petBreeds" required />
      </label>
      <label className="wide">
        How did you become aware of the premises?
        <select name="marketingSource" required>
          <option value="">Choose</option>
          <option>Website enquiry</option>
          <option>Approached or phoned PGP branch/agent</option>
          <option>Print advertisement</option>
          <option>To Let board</option>
          <option>Other</option>
        </select>
      </label>
      <div className="document-list">
        <h3>Required documents</h3>
        <label>
          Six months' business bank statements
          <input
            name="businessBankStatements"
            type="file"
            accept=".pdf,image/*"
            multiple
            required
          />
        </label>
        <label>
          CIPC registration/company documents
          <input
            name="registrationDocuments"
            type="file"
            accept=".pdf,image/*"
            multiple
            required
          />
        </label>
        <label>
          All directors'/members'/trustees' IDs - front and back
          <input
            name="directorIds"
            type="file"
            accept=".pdf,image/*"
            multiple
            required
          />
        </label>
        <label>
          Resolution signed by all directors authorising one director to sign
          all rental documents
          <input name="resolution" type="file" accept=".pdf,image/*" required />
        </label>
      </div>
      <h2>Consent and signature</h2>
      <label className="wide">
        Electronic signature - authorised signatory's full name
        <input name="signature" required />
      </label>
      <label>
        Signature date
        <input name="signatureDate" type="date" required />
      </label>
      <label className="wide consent">
        <input name="consent" type="checkbox" value="Accepted" required />
        <span>
          I warrant that the information is correct, the applicant is trading in
          solvent circumstances, I am duly authorised, and I accept the consent,
          credit-check and application terms in the official Pam Golding form.
        </span>
      </label>
    </div>
  );
}
