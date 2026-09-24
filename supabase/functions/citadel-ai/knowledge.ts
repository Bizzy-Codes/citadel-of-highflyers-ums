// What Citadel AI knows about the school. Everything here is public --
// it's the same information the website already shows -- and it is sent
// to Gemini with every question, so keep it short and factual.
//
// KEEP IN SYNC: fees and bank details mirror src/lib/feeSchedule.ts and
// the application fee in src/pages/marketing/Admissions.tsx. After
// editing, redeploy the function (`supabase functions deploy citadel-ai`).

export const SCHOOL_FACTS = `
SCHOOL
- Name: Citadel of Highflyers Int'l Academy ("Citadel"). Motto: "Foundation for Future Generals".
- A co-educational private nursery and primary school in Jos, Nigeria. Faith-based: "raising Godly future generals".
- Address: Rock Haven, opposite St. Murumba College, Jos, Plateau State.
- Phone / WhatsApp: +234 706 497 0003 (07064970003). Email: citadelofhighflyersintlacademy@gmail.com.
- Curriculum: British-Nigerian integrated curriculum, STEM and digital literacy for every grade, small class sizes.
- Classes, in order: Daycare, Reception, Kindergarten 1, Kindergarten 2, Pre-Grade, Grade 1, Grade 2, Grade 3, Grade 4, Grade 5.
  The "Kindergarten" arm is Reception to Kindergarten 2; the "Graders" arm is Pre-Grade to Grade 5.

PEOPLE
- Founder & Visionary: Pastor Chrispraise Iwunna (United Nations Peace Ambassador).
- Proprietor & Lead Educator: Ambassador Iwunna Princess.
- Head Teacher & Head of Kindergarten: Ruth Sankira. Head of the Graders arm: Lene Temi.
- Administrative Officer: Ozoegwu Onyinye Claire. School Club/Program Manager: Eggah Freeda.

ADMISSION (new families)
- Apply online on the Admissions page: fill the child's details and upload documents (birth certificate, immunisation record, previous school report -- optional).
- Then pay the application processing fee of N2,000, either cash at the school office or bank transfer (upload the receipt).
- Then message the school on WhatsApp; the admissions team sends the prospectus and welcome pack and confirms the class.

FEES PER TERM (the "Financial Involvement" sheet on the Fees page)
- Reception & Kindergarten classes: tuition N54,900 + registration/development N20,500. Uniforms: complete suit N21,500, sportswear N11,700, 2 T-shirts N12,600, cardigan N10,800.
- Pre-Grade / Graders classes: tuition N56,700 + registration/development N20,500. Uniforms: complete suit N21,800, sportswear N11,700, 2 T-shirts N12,600, cardigan N11,500.
- Pay into: First Bank, account name Citadel of Highflyers Int'l Academy, account number 2032386769. Send the receipt to WhatsApp 07064970003.
- Parents already in the portal can also upload a receipt on the portal's Fees page.

THE PORTAL (for pupils, parents, teachers and admins)
- Pupils (or their parents) create an account themselves from the login page ("Create an Account", choose Pupil). No email check -- they can sign in straight away. The school then puts them in their class.
- Brothers and sisters can all be registered with the same parent email.
- Pupils sign in with their NAME or login ID (like "CH 001") and password. Accounts made by the school start with the password citadel1234, which they should change.
- Teachers register with "Create an Account" and choose Staff. An admin must approve them before they can use the portal.
- Forgot password: use "Forgot Password?" on the login page, or ask the school office to reset it.
- Inside the portal pupils can see assignments (and upload their work), tests, results and report cards, attendance, the school calendar, timetable, fees, messages and their profile.
- Teachers take the daily attendance "Register", post assignments and tests, and enter report cards.
`;
