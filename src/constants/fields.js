export const FIELDS = [
  { id: "all",         label: "ALL" },
  { id: "firstName",   label: "FIRST" },
  { id: "lastName",    label: "LAST" },
  { id: "dob",         label: "DOB" },
  { id: "ethnicity",   label: "ETHN" },
  { id: "sex",         label: "SEX" },
  { id: "address",     label: "ADDR" },
  { id: "description", label: "NOTES" },
];

export const FIELD_ALIASES = {
  "first name": "firstName", "firstname": "firstName", "first": "firstName",
  "last name":  "lastName",  "lastname":  "lastName",  "last":  "lastName",
  "dob": "dob", "date of birth": "dob", "birthday": "dob", "birthdate": "dob", "birth date": "dob",
  "ethnicity": "ethnicity", "race": "ethnicity", "background": "ethnicity", "nationality": "ethnicity",
  "sex": "sex", "gender": "sex",
  "address": "address", "location": "address", "home": "address",
  "description": "description", "notes": "description", "bio": "description", "about": "description", "info": "description",
  "country": "country",
  "status": "status", "vitals": "status",
};
