import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_TOTAL_SIZE = 30 * 1024 * 1024;
const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

function escapeHtml(value: FormDataEntryValue | null) {
  return String(value || "").replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[character]!));
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    const allowedRecipients = (process.env.APPLICATION_RECIPIENTS || "").split(",").map(email => email.trim().toLowerCase()).filter(Boolean);
    if (!apiKey || !from || !allowedRecipients.length) return NextResponse.json({error:"Application email service is not configured."}, {status:503});

    const form = await request.formData();
    const recipient = String(form.get("agentEmail") || "").trim().toLowerCase();
    const type = String(form.get("applicationType") || "");
    if (!allowedRecipients.includes(recipient)) return NextResponse.json({error:"This agent is not approved to receive applications."}, {status:403});
    if (!['individual','juristic'].includes(type)) return NextResponse.json({error:"Invalid application type."}, {status:400});

    const commonFields = ["premises","monthlyRental","occupationFrom","occupationTo","occupantCount","occupants","petCount","petBreeds","marketingSource","signature","signatureDate","consent"];
    const individualFields = ["fullName","cellphone","email","idNumber","dateOfBirth","saCitizen","residencePermit","sequestrated","maritalStatus","presentAddress","addressPeriod","currentRental","employmentType","employer","employerAddress","position","employmentPeriod","employerContact","employerEmail","monthlyIncome","otherIncome","spouseDetails","nearestRelative","relativeContact","landlordReference","landlordReferenceContact","employerReference","employerReferenceContact"];
    const juristicFields = ["entityName","registrationNumber","registeredAddress","entityType","directors","accountantName","accountantContact","accountantEmail","tradeReferences","signatoryName","signatoryId","signatoryCapacity","signatoryCell","signatoryEmail"];
    const requiredFiles = type === "individual" ? ["idFront","idBack","bankStatements","payslip"] : ["businessBankStatements","registrationDocuments","directorIds","resolution"];
    const missing = [...commonFields,...(type === "individual" ? individualFields : juristicFields)].filter(key => !String(form.get(key) || "").trim());
    const missingFiles = requiredFiles.filter(key => !(form.get(key) instanceof File) || !(form.get(key) as File).size);
    if (missing.length || missingFiles.length) return NextResponse.json({error:"Please complete every field and upload every required document."}, {status:400});

    const files = [...form.entries()].filter((entry): entry is [string, File] => entry[1] instanceof File && entry[1].size > 0);
    const totalSize = files.reduce((sum, [, file]) => sum + file.size, 0);
    if (!files.length || files.some(([,file]) => file.size > MAX_FILE_SIZE || !allowedTypes.has(file.type)) || totalSize > MAX_TOTAL_SIZE) {
      return NextResponse.json({error:"Upload PDF, JPG, PNG or WEBP files only. Maximum 10 MB per file and 30 MB total."}, {status:400});
    }

    const ignored = new Set(["agentEmail","applicationType"]);
    const rows = [...form.entries()].filter(([key,value]) => !ignored.has(key) && !(value instanceof File)).map(([key,value]) => `<tr><th style="text-align:left;padding:7px;border:1px solid #ddd">${escapeHtml(key.replace(/([A-Z])/g," $1"))}</th><td style="padding:7px;border:1px solid #ddd">${escapeHtml(value)}</td></tr>`).join("");
    const attachments = await Promise.all(files.map(async ([key,file]) => ({filename:`${key}-${file.name}`.replace(/[^a-zA-Z0-9._-]/g,"_"),content:Buffer.from(await file.arrayBuffer()).toString("base64")})));
    const property = escapeHtml(form.get("premises"));
    const applicant = escapeHtml(form.get(type === "individual" ? "fullName" : "entityName"));
    const response = await fetch("https://api.resend.com/emails", {method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({from,to:[recipient],subject:`${type === "individual" ? "Individual" : "Juristic"} tenant application - ${property}`,html:`<h1>New tenant application</h1><p><b>Applicant:</b> ${applicant}</p><p><b>Property:</b> ${property}</p><table style="border-collapse:collapse;width:100%">${rows}</table><p>All uploaded supporting documents are attached.</p>`,attachments})});
    if (!response.ok) return NextResponse.json({error:"The email provider could not send this application."}, {status:502});
    return NextResponse.json({ok:true});
  } catch {
    return NextResponse.json({error:"The application could not be submitted. Please try again."}, {status:500});
  }
}
