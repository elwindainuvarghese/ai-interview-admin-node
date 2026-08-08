const nodemailer = require('nodemailer');

// Set up the Nodemailer transporter using Ethereal for testing or standard SMTP for production.
const transporter = nodemailer.createTransport({
  service: 'gmail', // You can change this to another provider or custom SMTP
  auth: {
    user: process.env.EMAIL_USER || 'placeholder@gmail.com',
    pass: process.env.EMAIL_PASS || 'placeholder_app_password'
  }
});

async function sendResultEmail(candidateEmail, candidateName, score, passed) {
  try {
    const isPassing = passed || score >= 70;
    
    const passedHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #1DB96A;">Congratulations, ${candidateName}! 🎉</h2>
        <p>We are thrilled to inform you that you successfully passed your recent AI Technical Interview.</p>
        <div style="background-color: #f4f4f4; padding: 15px; border-left: 4px solid #1DB96A; margin: 20px 0;">
          <strong>Your Overall Technical Score:</strong> ${score} / 100
        </div>
        <p>Your demonstrated skills and technical expertise were very impressive. Our recruitment team will be reviewing your complete technical profile and will reach out to you shortly with the next steps.</p>
        <p>Thank you for your time, and we look forward to connecting with you soon.</p>
        <br/>
        <p>Best regards,</p>
        <p><strong>The Recruitment Team</strong></p>
      </div>
    `;

    const failedHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #E74C3C;">Update on your Interview Application</h2>
        <p>Dear ${candidateName},</p>
        <p>Thank you for taking the time to participate in our AI Technical Interview.</p>
        <div style="background-color: #f4f4f4; padding: 15px; border-left: 4px solid #E74C3C; margin: 20px 0;">
          <strong>Your Overall Technical Score:</strong> ${score} / 100
        </div>
        <p>While we appreciate your effort, we have decided to move forward with other candidates who more closely match our technical requirements at this time.</p>
        <p>We encourage you to continue developing your skills and wish you the best in your future endeavors.</p>
        <br/>
        <p>Best regards,</p>
        <p><strong>The Recruitment Team</strong></p>
      </div>
    `;

    const mailOptions = {
      from: `"AI Interview Platform" <${process.env.EMAIL_USER || 'no-reply@ai-interview.com'}>`,
      to: candidateEmail,
      subject: isPassing ? 'Congratulations! You Passed the Technical Interview' : 'Update on your Technical Interview',
      html: isPassing ? passedHtml : failedHtml
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('[Email] Result email sent to', candidateEmail, 'Message ID:', info.messageId);
  } catch (error) {
    console.error('[Email] Failed to send result email to', candidateEmail, error);
  }
}

module.exports = {
  sendResultEmail
};
