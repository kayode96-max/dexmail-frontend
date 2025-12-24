
export type Mail = {
  id: string;
  name: string;
  email: string;
  subject: string;
  text: string;
  date: string;
  read: boolean;
  labels: string[];
  body: string;
  status: 'inbox' | 'sent' | 'draft' | 'spam' | 'archive' | 'trash';
  hasCryptoTransfer?: boolean;
  assets?: any[]; // Using any[] to avoid circular deps or complex types for now
  inReplyTo?: string;
};

export const mails: Mail[] = [
  {
    id: 'user-avatar-1',
    name: 'Azie Melasari, me (9)',
    email: 'azie.melasari@example.com',
    subject: 'Full Time UI Designer - Judha Maygustya',
    text: 'Dear Mrs Azie Melasari, I am Judha Maygustya, writing to ex...',
    date: '2023-10-22T10:00:00.000Z',
    read: false,
    labels: ['Client Inquiries'],
    status: 'inbox',
    body: `Dear Mrs. Azie Melasari,

I am Judha Maygustya, writing to express my keen interest in the Full Time UI Designer position at your company. With a strong background in user interface and experience design, I am confident in my ability to contribute effectively to your team.

Throughout my career, I have been dedicated to creating intuitive and visually appealing digital experiences. I am proficient in a variety of design tools and have a deep understanding of user-centered design principles. I am eager to bring my skills and passion for design to a dynamic and innovative environment.

Thank you for considering my application. I have attached my resume for your review and look forward to the possibility of discussing this exciting opportunity with you further.

Sincerely,
Judha Maygustya`
  },
  {
    id: 'user-avatar-2',
    name: 'Emura Daily News',
    email: 'news@emuradaily.com',
    subject: 'Emura Daily News - Latest Updates',
    text: 'Welcome to Emura Daily News! Here are the latest updates and hi...',
    date: '2023-10-21T10:00:00.000Z',
    read: true,
    labels: [],
    status: 'inbox',
    body: `Welcome to Emura Daily News!

Here are the latest updates and highlights from around the world. Our team has been working hard to bring you the most relevant and up-to-date information.

In today's edition, we cover breakthroughs in technology, important global events, and inspiring stories from communities making a difference. We believe in keeping you informed and engaged with the world around you.

Thank you for being a valued subscriber. We appreciate your support and look forward to bringing you more news and stories.

Best regards,
The Emura Daily News Team`
  },
  {
    id: 'user-avatar-3',
    name: 'JAGO',
    email: 'promo@jago.com',
    subject: 'Glamping with a view get a DISCOUNT of 75 thousand?!',
    text: 'How are you, Hero? Looking for a healing pla...',
    date: '2023-10-20T10:00:00.000Z',
    read: true,
    labels: [],
    status: 'spam',
    body: `How are you, Hero?

Looking for a healing place with a stunning view? Get a DISCOUNT of 75 thousand for your next glamping adventure! Imagine waking up to breathtaking scenery and enjoying nature in comfort and style.

This is the perfect opportunity to take a break from the hustle and bustle of daily life and reconnect with the great outdoors. Our glamping sites offer a unique blend of luxury and nature, providing an unforgettable experience.

Don't miss out on this limited-time offer. Book your glamping trip today and create memories that will last a lifetime.

Cheers,
The JAGO Team`
  },
  {
    id: 'user-avatar-4',
    name: 'Zidane Nurabidin',
    email: 'zidane.n@example.com',
    subject: "Let's Plan a Getaway!",
    text: "I hope you're doing well! I was thinking it might be a great time for a little getawa...",
    date: '2023-10-19T10:00:00.000Z',
    read: false,
    labels: [],
    status: 'inbox',
    body: `Hey,

I hope you're doing well! I was thinking it might be a great time for a little getaway. It's been a while since we've had a chance to relax and have some fun.

I've been looking at a few destinations, and I'm open to suggestions. Whether it's a beach trip, a mountain retreat, or exploring a new city, I'm up for an adventure. Let me know what you think and if you have any ideas.

It would be great to catch up and create some new memories. Looking forward to hearing from you!

Best,
Zidane Nurabidin`
  },
  {
    id: 'user-avatar-5',
    name: 'Robbi Darwis, me (5)',
    email: 'robbi.darwis@example.com',
    subject: 'Happy Birthday!',
    text: 'I hope your special day is filled with happiness, good health, and everything that bring...',
    date: '2023-10-18T10:00:00.000Z',
    read: true,
    labels: [],
    status: 'sent',
    body: `Happy Birthday!

I hope your special day is filled with happiness, good health, and everything that brings you joy. May the year ahead be full of exciting opportunities and wonderful experiences.

It's been a pleasure knowing you, and I wish you all the best on your birthday and in the coming year. Let's celebrate soon and make some more great memories together.

Warmly,
Robbi Darwis`
  },
  {
    id: 'user-avatar-6',
    name: 'LinkedIn',
    email: 'notification@linkedin.com',
    subject: 'Muhammad Royhan Darmawan and 13 others commented',
    text: "Showcase porto\" Hey everyone! I'm ex...",
    date: '2023-10-17T10:00:00.000Z',
    read: true,
    labels: [],
    status: 'trash',
    body: `"Showcase porto"

Hey everyone! I'm excited to share my latest project with you all. It's been a journey of hard work and creativity, and I'm proud of the final result.

Muhammad Royhan Darmawan and 13 others commented on your post. It's great to see so much engagement and feedback from the community. Thank you for all the support and encouragement!

I'm always looking for new opportunities to collaborate and create. Feel free to reach out if you have any ideas or just want to connect.

Best regards,
Your Name`
  },
  {
    id: 'user-avatar-7',
    name: 'M. Rafi Irfansyah',
    email: 'rafi.irfansyah@example.com',
    subject: 'Long Time No Talk!',
    text: "It's been a minute since we last caught up. Just wanted to check in and have a laid-...",
    date: '2023-10-16T10:00:00.000Z',
    read: true,
    labels: [],
    status: 'inbox',
    body: `Hey,

It's been a minute since we last caught up. Just wanted to check in and have a laid-back chat. I hope everything has been going well with you.

Life has been busy, but I've been thinking it would be great to reconnect and hear what you've been up to. Let me know if you have some free time to talk or maybe even grab a coffee.

Looking forward to hearing from you!

Cheers,
M. Rafi Irfansyah`
  },
  {
    id: 'user-avatar-8',
    name: 'Muzaki Gurfon, me (9)',
    email: 'muzaki.gurfon@example.com',
    subject: "Let's Catch Up!",
    text: "Just thought I'd drop a message to catch up and chat a bit. It's been a while, and it wou...",
    date: '2023-10-15T10:00:00.000Z',
    read: true,
    labels: [],
    status: 'inbox',
    body: `Hey,

Just thought I'd drop a message to catch up and chat a bit. It's been a while, and it would be great to hear how you're doing.

I've been keeping busy with work and a few personal projects, but I'd love to make time to reconnect. Let me know if you're free for a call or if you'd like to meet up sometime soon.

Hope to hear from you!

Best,
Muzaki Gurfon`
  },
  {
    id: 'user-avatar-9',
    name: 'Google',
    email: 'no-reply@google.com',
    subject: 'Inquiry Regarding Google Services',
    text: "I'm reaching out to inquire about some of the services and tools G...",
    date: '2023-10-14T10:00:00.000Z',
    read: true,
    labels: [],
    status: 'draft',
    body: `Dear Google Team,

I'm reaching out to inquire about some of the services and tools Google offers. I'm particularly interested in learning more about the advanced features of Google Analytics and how they can be integrated with other Google products.

Our team is looking to optimize our digital strategy, and we believe that a deeper understanding of your services could be beneficial. Any information or resources you could provide would be greatly appreciated.

Thank you for your time and assistance.

Sincerely,
A Curious User`
  },
  {
    id: 'user-avatar-10',
    name: 'Alfan Olivan, me (9)',
    email: 'alfan.olivan@example.com',
    subject: 'Job Opportunity: Project Manager',
    text: "I'm currently looking to hire a talented and experienced Project Man...",
    date: '2023-10-13T10:00:00.000Z',
    read: true,
    labels: ['Client Inquiries'],
    status: 'inbox',
    body: `Hi,

I'm currently looking to hire a talented and experienced Project Manager to join our team. We are a fast-growing company with a passion for innovation and excellence.

The ideal candidate will have a strong background in project management, excellent communication skills, and a proven track record of delivering projects on time and within budget. This is a great opportunity for someone who is looking to take on new challenges and grow with our company.

If you or someone you know is interested, please don't hesitate to reach out.

Best regards,
Alfan Olivan`
  },
  {
    id: 'user-avatar-11',
    name: 'Google',
    email: 'security-noreply@google.com',
    subject: 'Security Alert: Action Required to Protect Your Account',
    text: 'We detected suspicious activity that may ha...',
    date: '2023-10-12T10:00:00.000Z',
    read: true,
    labels: [],
    status: 'archive',
    body: `Security Alert: Action Required to Protect Your Account

We detected suspicious activity that may indicate unauthorized access to your account. To protect your information, we recommend that you take immediate action.

Please review your recent activity and ensure that all devices and sessions are recognized. If you see anything unusual, please change your password and enable two-factor authentication for added security.

Your account's safety is our top priority. Thank you for your prompt attention to this matter.

Sincerely,
The Google Security Team`
  },
  {
    id: 'user-avatar-12',
    name: 'Faris Hadi Mulyo, me (5)',
    email: 'faris.hadi@example.com',
    subject: "Let's Collaborate on a Web Development Project!",
    text: 'I believe our combined skills could lead to somethin...',
    date: '2023-10-11T10:00:00.000Z',
    read: true,
    labels: [],
    status: 'sent',
    body: `Hey,

I hope you're doing well. I'm reaching out because I have an exciting web development project in mind, and I think our skills would be a great match for it. I believe our combined expertise could lead to something truly amazing.

I've always admired your work, and I'm confident that we could create a fantastic product together. Let me know if you're interested in hearing more about the project and discussing a potential collaboration.

Looking forward to the possibility of working with you.

Best,
Faris Hadi Mulyo`
  },
  {
    id: 'user-avatar-13',
    name: 'Paypall',
    email: 'service@paypal.com',
    subject: "You've received $1,430.00 USD from Emura Studio",
    text: 'Judha Maygustya, you received $430 USD Dear J...',
    date: '2023-10-10T10:00:00.000Z',
    read: true,
    labels: ['Billing & Payments'],
    status: 'inbox',
    body: `Dear Judha Maygustya,

You've received $1,430.00 USD from Emura Studio. This payment has been successfully processed and is now available in your PayPal account.

We appreciate your business and look forward to working with you again in the future. If you have any questions or concerns about this transaction, please do not hesitate to contact us.

Thank you for choosing PayPal.

Sincerely,
The PayPal Team`
  },
  {
    id: 'user-avatar-14',
    name: 'Ryan, me (24)',
    email: 'ryan@example.com',
    subject: 'Inquiry About Design Fee',
    text: 'I wanted to inquire about the fee for a single design project with you. Could...',
    date: '2023-10-09T10:00:00.000Z',
    read: true,
    labels: [],
    status: 'draft',
    body: `Hi,

I wanted to inquire about the fee for a single design project with you. I've been following your work for a while, and I'm very impressed with your style and creativity.

I have a project in mind that I think would be a great fit for your skills. Could you please provide me with some information on your design fees and availability? I'm looking forward to the possibility of working together.

Thank you for your time.

Best,
Ryan`
  },
  {
    id: 'user-avatar-15',
    name: 'Galang Andhika',
    email: 'galang.andhika@example.com',
    subject: 'Website Design Collaboration',
    text: "I'm reaching out to explore the possibility of a design collaboration betw...",
    date: '2023-10-08T10:00:00.000Z',
    read: true,
    labels: ['Project Updates'],
    status: 'inbox',
    body: `Hello,

I'm reaching out to explore the possibility of a design collaboration between us. I've been following your portfolio, and I'm incredibly impressed with your talent and creativity.

I believe that our combined skills could result in some truly exceptional work. I have a few project ideas in mind, but I'm also open to brainstorming new concepts together.

Let me know if you're interested in discussing this further. I'm excited about the potential of what we could create.

Best regards,
Galang Andhika`
  },
  {
    id: 'user-avatar-16',
    name: 'Paypall',
    email: 'service@paypal.com',
    subject: "You've received $230.00 USD from Upwork",
    text: 'Judha Maygustya, you received $230 USD Dear Judha M...',
    date: '2023-10-07T10:00:00.000Z',
    read: true,
    labels: ['Billing & Payments'],
    status: 'inbox',
    body: `Dear Judha Maygustya,

You've received $230.00 USD from Upwork. This payment is now available in your PayPal account.

Thank you for your hard work and dedication. We appreciate your contributions and look forward to continuing our partnership. If you have any questions about this payment, please feel free to reach out.

Sincerely,
The PayPal Team`
  },
  {
    id: 'user-avatar-17',
    name: 'Coinbase',
    email: 'no-reply@info.coinbase.com',
    subject: '425168 is your login code',
    text: 'Your login code 425168 This code will expire in 5 minutes...',
    date: '2023-10-24T10:09:00.000Z',
    read: false,
    labels: [],
    status: 'inbox',
    body: `
<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: Arial, sans-serif; color: #333; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px; }
  .code { font-size: 32px; font-weight: bold; margin: 20px 0; letter-spacing: 2px; }
  .footer { color: #888; font-size: 12px; margin-top: 30px; }
  .lock { display: flex; align-items: center; gap: 5px; color: #666; font-size: 14px; margin-top: 20px; }
</style>
</head>
<body>
  <div class="container">
    <div style="display: flex; align-items: center; margin-bottom: 20px;">
      <div style="width: 32px; height: 32px; background-color: #0052FF; border-radius: 50%; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold;">C</div>
      <div style="margin-left: 10px; font-weight: bold;">coinbase</div>
    </div>
    
    <h2>Your login code</h2>
    
    <div class="code">425168</div>
    
    <p>This code will expire in 5 minutes. Do not share this code with anyone.</p>
    
    <div style="margin-top: 30px;">
      <div>Platform: <b>Windows</b></div>
      <div>Time: <b>Dec 24, 2025, 10:09 AM</b></div>
    </div>
    
    <p style="margin-top: 30px; color: #666;">Didn't request this code? You can safely ignore this email.</p>
    
    <div class="lock">
      <span>🔒</span> Secured by Coinbase
    </div>
  </div>
</body>
</html>
    `
  }
];
