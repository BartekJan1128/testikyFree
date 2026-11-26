export type Profile = {
  id: string
  email: string
  display_name: string | null
  is_admin: boolean
  created_at: string
}

export type Test = {
  id: number
  title: string
  description: string
  shuffle_questions: boolean
  shuffle_answers: boolean
  is_published: boolean
  created_at: string
}

export type Answer = {
  id: number
  question_id: number
  text: string
  is_correct: boolean
  position: number
}

export type Question = {
  id: number
  test_id: number
  text: string
  explanation: string
  position: number
  answers: Answer[]
}

export type Attempt = {
  id: number
  test_id: number | null
  test_title: string
  user_id: string
  started_at: string | null
  finished_at: string
  correct_count: number
  total_count: number
  score_pct: number
  profiles?: { display_name: string | null; email: string } | null
}

export type SnapshotAnswer = { id: number; text: string; is_correct: boolean }

export type AttemptAnswer = {
  id: number
  attempt_id: number
  question_id: number
  question_text: string
  explanation: string
  answers: SnapshotAnswer[]
  selected_answer_ids: number[]
  is_correct: boolean
  position: number
}

export type MyTest = {
  id: number
  title: string
  description: string
  question_count: number
  best_pct: number | null
  attempts_count: number
  last_at: string | null
}

export type ImportQuestion = {
  text: string
  explanation?: string
  answers: { text: string; correct: boolean }[]
}
