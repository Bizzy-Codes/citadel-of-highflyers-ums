// People's names are kept in CAPITALS everywhere (see patch_27.sql,
// which enforces the same at the database). These keep the form field
// in step as the parent types, so what they see is what gets saved.
export const upperName = (value: string) => value.toUpperCase();

// The login box takes a name, a login ID or an email. Emails are left
// as typed; anything else is shown in capitals like every other name.
export const upperLoginId = (value: string) => (value.includes('@') ? value : value.toUpperCase());
