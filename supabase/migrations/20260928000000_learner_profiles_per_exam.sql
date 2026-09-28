-- MarksenseAI per-exam: a learner has one profile PER EXAM (SSC and SBI are
-- different entities with different sections/scoring, so one mixed profile is
-- wrong). Add exam_code and re-key. Existing rows are SSC CGL.
alter table learner_profiles add column if not exists exam_code text not null default 'ssc-cgl';
alter table learner_profiles drop constraint if exists learner_profiles_pkey;
alter table learner_profiles add primary key (user_id, exam_code);

alter table learner_profile_snapshots add column if not exists exam_code text not null default 'ssc-cgl';
alter table learner_profile_snapshots drop constraint if exists learner_profile_snapshots_user_id_signals_hash_key;
alter table learner_profile_snapshots
  add constraint learner_profile_snapshots_user_exam_hash_key unique (user_id, exam_code, signals_hash);
