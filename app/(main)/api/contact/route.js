"use server";

import nodemailer from "nodemailer";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { name, email, organization, message } = await request.json();

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Name, email, and message are required." },
        { status: 400 },
      );
    }

    const host = process.env.CONTACT_SMTP_HOST;
    const user = process.env.CONTACT_SMTP_USER;
    const pass = process.env.CONTACT_SMTP_PASS;
    const port = Number(process.env.CONTACT_SMTP_PORT || 587);
    const secure = process.env.CONTACT_SMTP_SECURE === "true";
    const toEmail = process.env.CONTACT_TO_EMAIL || "admin@mymeedai.org";

    if (!host || !user || !pass) {
      console.error("[contact] Missing SMTP credentials");
      return NextResponse.json(
        { error: "Email transport is not configured." },
        { status: 500 },
      );
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });

    const orgLine = organization ? `Organization / Site: ${organization}\n` : "";

    await transporter.sendMail({
      from: `"${name}" <${user}>`,
      replyTo: email,
      to: toEmail,
      subject: `MeedianAI Flow Contact — ${name}`,
      text:
        `You received a new message from the MeedianAI Flow landing page.\n\n` +
        `Name: ${name}\n` +
        `Email: ${email}\n` +
        orgLine +
        `Message:\n${message}\n`,
      html: `
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        ${organization ? `<p><strong>Organization / Site:</strong> ${organization}</p>` : ""}
        <p><strong>Message:</strong></p>
        <p style="white-space:pre-line;">${message}</p>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[contact] Failed to send email", error);
    return NextResponse.json(
      { error: "Failed to send your message. Please try again later." },
      { status: 500 },
    );
  }
}
