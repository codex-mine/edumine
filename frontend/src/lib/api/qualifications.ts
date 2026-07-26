export interface QualificationInput {
  education_title: string;
  institute: string;
  grade?: string | null;
  passing_year?: number | null;
  additional_info?: string | null;
  certificate_url?: string | null;
  marksheet_url?: string | null;
}

export interface Qualification extends QualificationInput {
  id: string;
}

export function emptyQualification(): QualificationInput {
  return {
    education_title: "",
    institute: "",
    grade: "",
    passing_year: null,
    additional_info: "",
    certificate_url: null,
    marksheet_url: null,
  };
}
