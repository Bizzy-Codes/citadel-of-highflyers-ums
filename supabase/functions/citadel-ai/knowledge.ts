// What Citadel AI knows about the school, sent to Gemini with every
// question -- so keep it short and factual.
//
// NEVER add anything private: passwords (not even the default one),
// admin names/emails/logins, keys, internal links or how the system is
// built. Whatever is here, anyone can get the AI to repeat.
//
// Money AMOUNTS are private (the school's decision, 2026-09-28): fees,
// uniform prices and the application fee go in MONEY_FACTS, which
// index.ts only includes for someone the server has confirmed is signed
// in to the portal. Visitors are told to log in or contact the school.
// The school's BANK DETAILS are public (decided 2026-10-07: anyone who
// wants to pay must be able to get them) and live in SCHOOL_FACTS.
//
// KEEP IN SYNC: MONEY_FACTS mirrors src/lib/feeSchedule.ts and the
// application fee in src/pages/marketing/Admissions.tsx. After editing,
// redeploy the function.

// Also in src/lib/feeSchedule.ts (SCHOOL_BANK) -- keep in sync.
export const SCHOOL_ACCOUNT_NUMBER = '2032386769';

export const SCHOOL_FACTS = `
SCHOOL
- Name: Citadel of Highflyers Int'l Academy ("Citadel"). Motto: "Foundation for Future Generals".
- A co-educational private nursery and primary school in Jos, Nigeria. Faith-based: "raising Godly future generals".
- Vision: "We are poised to raise Godly future generals."
- Mission: "To create an enabling environment where children, through divine wisdom, are raised spiritually, socially, emotionally, morally, and academically to become future generals."
- Parents can trust the school for: a Godly and moral standard; a small number of pupils in each class; a high academic standard; practical use of good diction; boldness, confidence and independence in each child; every child being a star.
- Address: Rock Haven, opposite St. Murumba College, Jos, Plateau State.
- Phone / WhatsApp: +234 706 497 0003 (07064970003). Email: citadelofhighflyersintlacademy@gmail.com.
- Curriculum: British-Nigerian integrated curriculum, STEM and digital literacy for every grade, small class sizes, digital tools and video resources in lessons.
- Classes, in order: Daycare, Reception, Kindergarten 1, Kindergarten 2, Pre-Grade, Grade 1, Grade 2, Grade 3, Grade 4, Grade 5.
  The "Kindergarten" arm is Reception to Kindergarten 2; the "Graders" arm is Pre-Grade to Grade 5.

PEOPLE
- Founder & Visionary: Pastor Chrispraise Iwunna (United Nations Peace Ambassador).
- Proprietor & Lead Educator: Ambassador Iwunna Princess.
- Head Teacher & Head of Kindergarten: Ruth Sankira. Head of the Graders arm: Lene Temi.
- Administrative Officer: Ozoegwu Onyinye Clare. School Club/Program Manager: Eggah Freeda.

ADMISSION (new families)
- Apply online on the Admissions page: fill the child's details and upload documents (birth certificate, immunisation record, previous school report -- optional).
- Then pay the application processing fee (the admissions page shows how), either cash at the school office or bank transfer.
- Then message the school on WhatsApp; the admissions team sends the prospectus and welcome pack and confirms the class.

THE PORTAL (for pupils, parents, teachers and admins)
- Pupils (or their parents) create an account themselves from the login page ("Create an Account", choose Pupil). No email check -- they can sign in straight away. The school then puts them in their class.
- Brothers and sisters can all be registered with the same parent email.
- Pupils sign in with their NAME or login ID (like "CH 001") and their password. The school gives each family their password privately.
- Pupils and teachers cannot change or reset their own password. Only the school admin can change a password, so anyone who forgets theirs must contact the school office.
- Teachers register with "Create an Account" and choose Staff. An admin must approve them before they can use the portal.
- Forgot password: contact the school office -- the admin gives a new password.
- Inside the portal pupils can see assignments (they read the questions and write answers in their notebook; some assignments have a typed answer sheet), tests, results and report cards, attendance, the school calendar, timetable, fees, messages and their profile.
- Teachers take the daily attendance "Register", post assignments and tests, and enter report cards.

BANK DETAILS (public -- anyone may be given these; they contain no fee amounts)
- Bank: First Bank. Account name: Citadel of Highflyers Int'l Academy. Account number: 2032386769.
- After paying, send the payment receipt to WhatsApp 07064970003. Portal pupils can also upload it on the portal's Fees page.
- There is a page with these details (page key bank_details). When someone asks for the account number, bank, or where/how to pay, tell them the details in words AND call open_page with bank_details. Never open the fees page for this, and never mention any fee amount to someone who is not signed in.
`;

// Only for people signed in to the portal -- see the note at the top.
export const MONEY_FACTS = `
FEES AND PAYMENTS (portal users only -- never give these to a visitor who isn't signed in)
- Fees per term, Reception & Kindergarten classes: tuition N54,900 + registration/development N20,500. Uniforms: complete suit N21,500, sportswear N11,700, 2 T-shirts N12,600, cardigan N10,800.
- Fees per term, Pre-Grade / Graders classes: tuition N56,700 + registration/development N20,500. Uniforms: complete suit N21,800, sportswear N11,700, 2 T-shirts N12,600, cardigan N11,500.
- Admission application processing fee: N2,000.
`;
