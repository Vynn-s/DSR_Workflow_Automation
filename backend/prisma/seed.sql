-- CathedralFlow Seed Data
-- San Pedro Cathedral Parish, Davao City
-- Supabase PostgreSQL
-- Safe to re-run (idempotent via ON CONFLICT DO NOTHING)
-- Targets: VenueRequest, ApprovalAction, AuditLog, SchedulingConflict
-- Users, Venues, Ministries, VenueMinistry already seeded -- not touched here

BEGIN;

WITH seed_requests(seed_key, venue_id, venue_name, event_name, purpose, start_at, end_at, attendees, special_requirements, attachments, status, current_approver_id, created_at, updated_at, approver_id, decision_remarks, decision_action, submit_ip, decision_ip, conflict_seed_key) AS (
  VALUES
  ('VR-001','562098e5-cf3f-439d-9fbb-51ec23ba9429','Socio Hall','Parish Youth Apostolate General Assembly','Quarterly youth assembly for parish formation planning.','2026-01-10 08:00:00','2026-01-10 11:00:00',180,'Set up registration tables, projector, and 180 chairs.','[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'APPROVED','4b6be2ba-b7f1-4372-9a23-7e44b2351eae','2026-01-06 09:20:00','2026-01-07 10:10:00','4b6be2ba-b7f1-4372-9a23-7e44b2351eae','Approved for parish youth formation use.','APPROVED','192.168.1.10','192.168.1.11',NULL),
  ('VR-002','ea79002d-e581-4e33-ade4-a2874a84e668','Meeting Room 2','Youth Ministry Planning Meeting','Planning session for January youth activities.','2026-01-12 09:00:00','2026-01-12 10:30:00',14,NULL,'[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'APPROVED','967c9939-4d9c-4939-b110-622188bd5c21','2026-01-08 13:00:00','2026-01-09 08:45:00','967c9939-4d9c-4939-b110-622188bd5c21','Approved for small group planning.','APPROVED','192.168.1.10','10.0.0.5',NULL),
  ('VR-003','55dbb026-1b2e-438f-9f16-d9d1722a5e9b','Mezzanine Hall A','Confirmation Class Session','Catechetical formation session for youth confirmands.','2026-01-17 13:00:00','2026-01-17 16:00:00',45,'Whiteboard and sound system requested.','[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'APPROVED','4b6be2ba-b7f1-4372-9a23-7e44b2351eae','2026-01-13 14:15:00','2026-01-14 09:30:00','4b6be2ba-b7f1-4372-9a23-7e44b2351eae','Approved; coordinate room setup with facilities.','APPROVED','192.168.1.10','192.168.1.11',NULL),
  ('VR-004','562098e5-cf3f-439d-9fbb-51ec23ba9429','Socio Hall','Youth Leadership Workshop','Leadership workshop for parish youth officers.','2026-01-24 08:00:00','2026-01-24 12:00:00',120,'Projector, two microphones, and workshop tables.','[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'APPROVED','967c9939-4d9c-4939-b110-622188bd5c21','2026-01-20 09:00:00','2026-01-21 11:00:00','967c9939-4d9c-4939-b110-622188bd5c21','Approved for youth workshop.','APPROVED','10.0.0.5','192.168.1.11',NULL),
  ('VR-005','fede3b1c-fbef-430a-8d5f-95e193c6709e','Meeting Room 1','Bible Sharing Session','Small group bible sharing and reflection.','2026-01-29 18:00:00','2026-01-29 19:30:00',16,NULL,'[]'::jsonb,'REJECTED',NULL,'2026-01-28 20:30:00','2026-01-28 22:00:00','4b6be2ba-b7f1-4372-9a23-7e44b2351eae','Request filed less than 24 hours before the event. Insufficient lead time.','REJECTED','192.168.1.10','192.168.1.11',NULL),
  ('VR-006','562098e5-cf3f-439d-9fbb-51ec23ba9429','Socio Hall','First Communion Retreat','Retreat and orientation for first communion families.','2026-02-07 08:00:00','2026-02-07 12:00:00',150,'Sound system and rows of chairs facing the stage.','[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'APPROVED','4b6be2ba-b7f1-4372-9a23-7e44b2351eae','2026-02-03 10:00:00','2026-02-04 09:15:00','4b6be2ba-b7f1-4372-9a23-7e44b2351eae','Approved for sacramental formation activity.','APPROVED','192.168.1.10','10.0.0.5',NULL),
  ('VR-007','0e41321c-ca02-480b-a46a-41c8f57654f9','Mezzanine Hall B','Music Ministry Choir Rehearsal','Choir rehearsal for youth-led liturgy.','2026-02-10 18:00:00','2026-02-10 20:00:00',38,NULL,'[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'APPROVED','967c9939-4d9c-4939-b110-622188bd5c21','2026-02-06 12:00:00','2026-02-07 08:10:00','967c9939-4d9c-4939-b110-622188bd5c21','Approved for rehearsal.','APPROVED','192.168.1.10','192.168.1.11',NULL),
  ('VR-008','86c940c9-27ac-4c26-8852-b8044eb90fd5','Parish Rectory','Baptismal Preparation Class','Preparation class support meeting for youth volunteers.','2026-02-14 09:00:00','2026-02-14 11:00:00',22,'Need one long table for facilitators.','[]'::jsonb,'REJECTED',NULL,'2026-02-10 15:00:00','2026-02-11 09:00:00','4b6be2ba-b7f1-4372-9a23-7e44b2351eae','No authorization letter attached. Please resubmit with complete documents.','REJECTED','10.0.0.5','192.168.1.11',NULL),
  ('VR-009','562098e5-cf3f-439d-9fbb-51ec23ba9429','Socio Hall','ANCOP Fundraising Event Preparation','Preparation and coordination for parish fundraising activity.','2026-02-21 13:00:00','2026-02-21 17:00:00',110,NULL,'[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'APPROVED','4b6be2ba-b7f1-4372-9a23-7e44b2351eae','2026-02-17 10:20:00','2026-02-18 14:00:00','4b6be2ba-b7f1-4372-9a23-7e44b2351eae','Approved; observe cleanup after event.','APPROVED','192.168.1.10','10.0.0.5',NULL),
  ('VR-010','55617a21-df7d-4b2d-935f-59b7080fd861','Blessed Sacrament Chapel','Marian Devotion Prayer Gathering','Prayer gathering and devotional reflection.','2026-02-26 15:00:00','2026-02-26 17:00:00',55,'Quiet setup with lectern and kneelers.','[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'APPROVED','967c9939-4d9c-4939-b110-622188bd5c21','2026-02-22 09:30:00','2026-02-23 10:10:00','967c9939-4d9c-4939-b110-622188bd5c21','Approved for devotional gathering.','APPROVED','192.168.1.10','192.168.1.11',NULL),
  ('VR-011','f4ebfabd-a43c-425e-ba3d-7ce3f1f0e51d','Auditorium','Annual Parish Assembly','Parish-wide annual assembly with youth participation.','2026-03-07 08:00:00','2026-03-07 12:00:00',300,'Full auditorium setup, projector, podium, and sound system.','[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'APPROVED','4b6be2ba-b7f1-4372-9a23-7e44b2351eae','2026-03-03 11:00:00','2026-03-04 09:45:00','4b6be2ba-b7f1-4372-9a23-7e44b2351eae','Approved for parish-wide assembly.','APPROVED','10.0.0.5','192.168.1.11',NULL),
  ('VR-012','562098e5-cf3f-439d-9fbb-51ec23ba9429','Socio Hall','Lenten Recollection','Youth lenten recollection and reflection sessions.','2026-03-14 08:00:00','2026-03-14 12:00:00',135,'Chairs, projector, and quiet prayer corner.','[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'APPROVED','967c9939-4d9c-4939-b110-622188bd5c21','2026-03-10 10:00:00','2026-03-11 08:30:00','967c9939-4d9c-4939-b110-622188bd5c21','Approved for Lenten activity.','APPROVED','192.168.1.10','10.0.0.5',NULL),
  ('VR-013','d860f22d-95a4-4125-9fae-969ed2bbbd25','Mezzanine Hall (Whole A & B)','Faith Formation Seminar','Seminar for youth ministry faith formation facilitators.','2026-03-18 13:00:00','2026-03-18 17:00:00',95,NULL,'[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'APPROVED','4b6be2ba-b7f1-4372-9a23-7e44b2351eae','2026-03-14 09:00:00','2026-03-15 11:00:00','4b6be2ba-b7f1-4372-9a23-7e44b2351eae','Approved for seminar.','APPROVED','192.168.1.10','192.168.1.11',NULL),
  ('VR-014','fede3b1c-fbef-430a-8d5f-95e193c6709e','Meeting Room 1','Parish Finance Committee Meeting','Coordination meeting with youth budget representatives.','2026-03-21 09:00:00','2026-03-21 10:30:00',18,NULL,'[]'::jsonb,'REJECTED',NULL,'2026-03-17 08:00:00','2026-03-18 09:20:00','967c9939-4d9c-4939-b110-622188bd5c21','Purpose description is insufficient. Please provide more detail.','REJECTED','10.0.0.5','192.168.1.11',NULL),
  ('VR-015','562098e5-cf3f-439d-9fbb-51ec23ba9429','Socio Hall','Livelihood Seminar for Parishioners','Youth-assisted livelihood seminar for parishioners.','2026-03-28 13:00:00','2026-03-28 17:00:00',160,'Tables for resource materials and projector.','[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'APPROVED','967c9939-4d9c-4939-b110-622188bd5c21','2026-03-24 10:00:00','2026-03-25 14:10:00','967c9939-4d9c-4939-b110-622188bd5c21','Approved for community seminar.','APPROVED','192.168.1.10','10.0.0.5',NULL),
  ('VR-016','ef461726-1d29-42a4-94d9-68d9a99d1b18','Chapel of the Saints','Charismatic Prayer Meeting','Prayer meeting and worship night for youth members.','2026-04-07 18:00:00','2026-04-07 20:00:00',42,NULL,'[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'APPROVED','4b6be2ba-b7f1-4372-9a23-7e44b2351eae','2026-04-03 08:00:00','2026-04-04 09:00:00','4b6be2ba-b7f1-4372-9a23-7e44b2351eae','Approved for prayer meeting.','APPROVED','192.168.1.10','192.168.1.11',NULL),
  ('VR-017','562098e5-cf3f-439d-9fbb-51ec23ba9429','Socio Hall','Eucharistic Ministers Training','Training support activity coordinated by youth volunteers.','2026-04-11 08:00:00','2026-04-11 11:00:00',125,'Sound system and training tables.','[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'APPROVED','967c9939-4d9c-4939-b110-622188bd5c21','2026-04-07 10:30:00','2026-04-08 09:00:00','967c9939-4d9c-4939-b110-622188bd5c21','Approved for training activity.','APPROVED','10.0.0.5','192.168.1.11',NULL),
  ('VR-018','0e41321c-ca02-480b-a46a-41c8f57654f9','Mezzanine Hall B','Marriage Encounter Follow-up Session','Follow-up session facilitated with youth service team.','2026-04-14 13:00:00','2026-04-14 16:00:00',50,NULL,'[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'REVISION_REQUESTED','a86d11c3-9435-4fc5-bd76-7aa97d752b7b','2026-04-10 12:00:00','2026-04-11 08:45:00','4b6be2ba-b7f1-4372-9a23-7e44b2351eae','Event purpose is too vague. Please describe the activity in detail.','REVISION_REQUESTED','192.168.1.10','10.0.0.5',NULL),
  ('VR-019','f4ebfabd-a43c-425e-ba3d-7ce3f1f0e51d','Auditorium','Catholic Lay Apologetics Talk','Public faith talk with youth attendance.','2026-04-18 14:00:00','2026-04-18 17:00:00',220,'Podium, projector, and sound system.','[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'APPROVED','967c9939-4d9c-4939-b110-622188bd5c21','2026-04-14 09:00:00','2026-04-15 10:30:00','967c9939-4d9c-4939-b110-622188bd5c21','Approved for apologetics talk.','APPROVED','192.168.1.10','192.168.1.11',NULL),
  ('VR-020','55617a21-df7d-4b2d-935f-59b7080fd861','Blessed Sacrament Chapel','Catechism Class for Adults','Adult catechism class with youth facilitators.','2026-04-23 09:00:00','2026-04-23 11:00:00',60,NULL,'[]'::jsonb,'REVISION_REQUESTED','a86d11c3-9435-4fc5-bd76-7aa97d752b7b','2026-04-19 15:00:00','2026-04-20 09:10:00','4b6be2ba-b7f1-4372-9a23-7e44b2351eae','Please attach the authorization letter signed by the parish priest.','REVISION_REQUESTED','10.0.0.5','192.168.1.11',NULL),
  ('VR-021','562098e5-cf3f-439d-9fbb-51ec23ba9429','Socio Hall','Parish Pastoral Council Meeting','Youth representatives meeting with parish pastoral council.','2026-04-25 08:00:00','2026-04-25 10:00:00',90,'U-shape table arrangement and microphone.','[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'APPROVED','4b6be2ba-b7f1-4372-9a23-7e44b2351eae','2026-04-21 08:30:00','2026-04-22 10:00:00','4b6be2ba-b7f1-4372-9a23-7e44b2351eae','Approved for council meeting.','APPROVED','192.168.1.10','10.0.0.5',NULL),
  ('VR-022','562098e5-cf3f-439d-9fbb-51ec23ba9429','Socio Hall','Knights of Columbus Regular Meeting','Coordination meeting with youth logistics team.','2026-04-25 10:30:00','2026-04-25 12:00:00',85,NULL,'[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'APPROVED','967c9939-4d9c-4939-b110-622188bd5c21','2026-04-21 09:45:00','2026-04-22 13:15:00','967c9939-4d9c-4939-b110-622188bd5c21','Approved; ensure quick turnover after prior booking.','APPROVED','192.168.1.10','192.168.1.11',NULL),
  ('VR-023','d860f22d-95a4-4125-9fae-969ed2bbbd25','Mezzanine Hall (Whole A & B)','Altar Servers Formation Day','Youth-assisted formation day for altar servers.','2026-05-02 08:00:00','2026-05-02 12:00:00',105,'Projector and four breakout tables.','[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'APPROVED','4b6be2ba-b7f1-4372-9a23-7e44b2351eae','2026-04-28 10:00:00','2026-04-29 09:00:00','4b6be2ba-b7f1-4372-9a23-7e44b2351eae','Approved for formation day.','APPROVED','10.0.0.5','192.168.1.11',NULL),
  ('VR-024','fede3b1c-fbef-430a-8d5f-95e193c6709e','Meeting Room 1','Youth Ministry Planning Meeting','Planning for Flores de Mayo youth assignments.','2026-05-06 14:00:00','2026-05-06 15:30:00',15,NULL,'[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'REJECTED',NULL,'2026-05-02 09:00:00','2026-05-03 08:30:00','967c9939-4d9c-4939-b110-622188bd5c21','Venue already reserved for a diocesan event on this date.','REJECTED','192.168.1.10','10.0.0.5',NULL),
  ('VR-025','562098e5-cf3f-439d-9fbb-51ec23ba9429','Socio Hall','Parish Youth Apostolate General Assembly','May general assembly for youth apostolate members.','2026-05-09 13:00:00','2026-05-09 17:00:00',170,'Sound system, registration table, and projector.','[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'APPROVED','4b6be2ba-b7f1-4372-9a23-7e44b2351eae','2026-05-05 08:00:00','2026-05-06 10:10:00','4b6be2ba-b7f1-4372-9a23-7e44b2351eae','Approved for youth assembly.','APPROVED','192.168.1.10','192.168.1.11',NULL),
  ('VR-026','55dbb026-1b2e-438f-9f16-d9d1722a5e9b','Mezzanine Hall A','Confirmation Class Session','Make-up confirmation class session.','2026-05-12 09:00:00','2026-05-12 12:00:00',52,NULL,'[]'::jsonb,'REVISION_REQUESTED','a86d11c3-9435-4fc5-bd76-7aa97d752b7b','2026-05-08 11:00:00','2026-05-09 08:20:00','967c9939-4d9c-4939-b110-622188bd5c21','Please confirm the final attendance count before resubmission.','REVISION_REQUESTED','10.0.0.5','192.168.1.11',NULL),
  ('VR-027','86c940c9-27ac-4c26-8852-b8044eb90fd5','Parish Rectory','Parish Finance Committee Meeting','Youth treasurer consultation for ministry budget.','2026-05-15 10:00:00','2026-05-15 11:30:00',18,NULL,'[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'REJECTED',NULL,'2026-05-11 09:00:00','2026-05-12 10:00:00','4b6be2ba-b7f1-4372-9a23-7e44b2351eae','Purpose description is insufficient. Please provide more detail.','REJECTED','192.168.1.10','10.0.0.5',NULL),
  ('VR-028','f4ebfabd-a43c-425e-ba3d-7ce3f1f0e51d','Auditorium','Faith Formation Seminar','Large faith formation talk for parish youth and families.','2026-05-17 13:00:00','2026-05-17 17:00:00',320,'Full auditorium, stage lights, projector, and sound system.','[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'APPROVED','967c9939-4d9c-4939-b110-622188bd5c21','2026-05-13 09:00:00','2026-05-14 08:45:00','967c9939-4d9c-4939-b110-622188bd5c21','Approved for large formation seminar.','APPROVED','192.168.1.10','192.168.1.11',NULL),
  ('VR-029','562098e5-cf3f-439d-9fbb-51ec23ba9429','Socio Hall','Livelihood Seminar for Parishioners','Follow-up livelihood seminar organized by youth volunteers.','2026-05-19 08:00:00','2026-05-19 12:00:00',140,'Tables and projector for resource speakers.','[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'REJECTED',NULL,'2026-05-15 10:00:00','2026-05-16 08:30:00','4b6be2ba-b7f1-4372-9a23-7e44b2351eae','Venue already reserved for a diocesan event on this date.','REJECTED','10.0.0.5','192.168.1.11',NULL),
  ('VR-030','ef461726-1d29-42a4-94d9-68d9a99d1b18','Chapel of the Saints','Marian Devotion Prayer Gathering','May devotion prayer gathering.','2026-05-20 18:00:00','2026-05-20 20:00:00',45,NULL,'[]'::jsonb,'REJECTED',NULL,'2026-05-16 15:00:00','2026-05-17 09:15:00','967c9939-4d9c-4939-b110-622188bd5c21','No authorization letter attached. Please resubmit with complete documents.','REJECTED','192.168.1.10','10.0.0.5',NULL),
  ('VR-031','562098e5-cf3f-439d-9fbb-51ec23ba9429','Socio Hall','Youth Leadership Workshop','Workshop for new youth servant leaders.','2026-05-22 13:00:00','2026-05-22 17:00:00',130,'Workshop seating and projector.','[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'APPROVED','4b6be2ba-b7f1-4372-9a23-7e44b2351eae','2026-05-18 09:00:00','2026-05-19 08:50:00','4b6be2ba-b7f1-4372-9a23-7e44b2351eae','Approved for youth workshop.','APPROVED','192.168.1.10','192.168.1.11',NULL),
  ('VR-032','0e41321c-ca02-480b-a46a-41c8f57654f9','Mezzanine Hall B','Music Ministry Choir Rehearsal','Choir rehearsal for Pentecost youth mass.','2026-05-23 18:00:00','2026-05-23 20:00:00',42,NULL,'[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'REJECTED',NULL,'2026-05-19 09:00:00','2026-05-20 09:30:00','967c9939-4d9c-4939-b110-622188bd5c21','Venue already reserved for a diocesan event on this date.','REJECTED','10.0.0.5','192.168.1.11',NULL),
  ('VR-033','55617a21-df7d-4b2d-935f-59b7080fd861','Blessed Sacrament Chapel','Bible Sharing Session','Evening bible sharing for youth members.','2026-05-24 17:00:00','2026-05-24 19:00:00',35,'Lectern and chairs in circle arrangement.','[]'::jsonb,'REVISION_REQUESTED','a86d11c3-9435-4fc5-bd76-7aa97d752b7b','2026-05-20 08:00:00','2026-05-21 10:00:00','4b6be2ba-b7f1-4372-9a23-7e44b2351eae','Event purpose is too vague. Please describe the activity in detail.','REVISION_REQUESTED','192.168.1.10','10.0.0.5',NULL),
  ('VR-034','562098e5-cf3f-439d-9fbb-51ec23ba9429','Socio Hall','Annual Parish Assembly','Overflow support assembly for youth volunteers.','2026-05-25 08:00:00','2026-05-25 12:00:00',190,'Registration tables, sound system, and projector.','[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'APPROVED','967c9939-4d9c-4939-b110-622188bd5c21','2026-05-21 10:00:00','2026-05-22 08:40:00','967c9939-4d9c-4939-b110-622188bd5c21','Approved for assembly support.','APPROVED','192.168.1.10','192.168.1.11',NULL),
  ('VR-035','fede3b1c-fbef-430a-8d5f-95e193c6709e','Meeting Room 1','Baptismal Preparation Class','Youth volunteer briefing for baptismal preparation support.','2026-05-26 09:00:00','2026-05-26 11:00:00',17,NULL,'[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'REJECTED',NULL,'2026-05-22 11:00:00','2026-05-23 08:20:00','4b6be2ba-b7f1-4372-9a23-7e44b2351eae','Attendance count exceeds venue capacity.','REJECTED','10.0.0.5','192.168.1.11',NULL),
  ('VR-036','d860f22d-95a4-4125-9fae-969ed2bbbd25','Mezzanine Hall (Whole A & B)','Parish Youth Apostolate General Assembly','Planning assembly for June activities.','2026-05-27 13:00:00','2026-05-27 17:00:00',100,'Projector and chairs in theater layout.','[]'::jsonb,'REVISION_REQUESTED','a86d11c3-9435-4fc5-bd76-7aa97d752b7b','2026-05-23 09:00:00','2026-05-24 10:30:00','967c9939-4d9c-4939-b110-622188bd5c21','Please attach the authorization letter signed by the parish priest.','REVISION_REQUESTED','192.168.1.10','10.0.0.5',NULL),
  ('VR-037','562098e5-cf3f-439d-9fbb-51ec23ba9429','Socio Hall','ANCOP Fundraising Event Preparation','Logistics planning for parish fundraising event.','2026-05-28 08:00:00','2026-05-28 11:00:00',95,NULL,'[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'REJECTED',NULL,'2026-05-24 10:00:00','2026-05-25 09:00:00','4b6be2ba-b7f1-4372-9a23-7e44b2351eae','Venue already reserved for a diocesan event on this date.','REJECTED','192.168.1.10','192.168.1.11',NULL),
  ('VR-038','f4ebfabd-a43c-425e-ba3d-7ce3f1f0e51d','Auditorium','Faith Formation Seminar','Pending seminar proposal for end of May.','2026-05-30 13:00:00','2026-05-30 17:00:00',250,'Needs auditorium projector and sound system.','[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'PENDING',NULL,'2026-05-29 09:00:00','2026-05-29 09:00:00',NULL,NULL,NULL,'192.168.1.10',NULL,NULL),
  ('VR-039','55dbb026-1b2e-438f-9f16-d9d1722a5e9b','Mezzanine Hall A','Youth Ministry Planning Meeting','Pending planning meeting request.','2026-05-31 09:00:00','2026-05-31 11:00:00',35,NULL,'[]'::jsonb,'PENDING',NULL,'2026-05-30 08:00:00','2026-05-30 08:00:00',NULL,NULL,NULL,'10.0.0.5',NULL,NULL),
  ('VR-040','ef461726-1d29-42a4-94d9-68d9a99d1b18','Chapel of the Saints','Marian Devotion Prayer Gathering','Pending prayer gathering proposal.','2026-05-31 15:00:00','2026-05-31 17:00:00',40,'Need quiet prayer setup and lectern.','[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'PENDING',NULL,'2026-05-30 11:00:00','2026-05-30 11:00:00',NULL,NULL,NULL,'192.168.1.10',NULL,NULL),
  ('VR-041','562098e5-cf3f-439d-9fbb-51ec23ba9429','Socio Hall','First Communion Retreat','Confirmed June retreat with parish youth volunteers.','2026-06-12 08:00:00','2026-06-12 12:00:00',160,'Chairs, sound system, and registration table.','[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'APPROVED','4b6be2ba-b7f1-4372-9a23-7e44b2351eae','2026-06-08 09:00:00','2026-06-09 08:30:00','4b6be2ba-b7f1-4372-9a23-7e44b2351eae','Approved for June retreat.','APPROVED','192.168.1.10','192.168.1.11',NULL),
  ('VR-042','f4ebfabd-a43c-425e-ba3d-7ce3f1f0e51d','Auditorium','Annual Parish Assembly','Confirmed high-attendance parish assembly.','2026-06-20 08:00:00','2026-06-20 12:00:00',340,'Full auditorium with stage, projector, and sound system.','[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'APPROVED','967c9939-4d9c-4939-b110-622188bd5c21','2026-06-16 10:00:00','2026-06-17 09:20:00','967c9939-4d9c-4939-b110-622188bd5c21','Approved for parish assembly.','APPROVED','10.0.0.5','192.168.1.11',NULL),
  ('VR-043','0e41321c-ca02-480b-a46a-41c8f57654f9','Mezzanine Hall B','Music Ministry Choir Rehearsal','Confirmed June choir rehearsal.','2026-06-18 18:00:00','2026-06-18 20:00:00',48,NULL,'[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'APPROVED','4b6be2ba-b7f1-4372-9a23-7e44b2351eae','2026-06-14 09:00:00','2026-06-15 11:00:00','4b6be2ba-b7f1-4372-9a23-7e44b2351eae','Approved for rehearsal.','APPROVED','192.168.1.10','10.0.0.5',NULL),
  ('VR-044','562098e5-cf3f-439d-9fbb-51ec23ba9429','Socio Hall','Youth Leadership Workshop','Confirmed July youth leadership workshop.','2026-07-04 08:00:00','2026-07-04 12:00:00',145,'Workshop tables, projector, and microphones.','[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'APPROVED','967c9939-4d9c-4939-b110-622188bd5c21','2026-06-30 09:00:00','2026-07-01 08:50:00','967c9939-4d9c-4939-b110-622188bd5c21','Approved for leadership workshop.','APPROVED','192.168.1.10','192.168.1.11',NULL),
  ('VR-045','d860f22d-95a4-4125-9fae-969ed2bbbd25','Mezzanine Hall (Whole A & B)','Faith Formation Seminar','Confirmed July faith formation seminar.','2026-07-11 13:00:00','2026-07-11 17:00:00',115,NULL,'[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'APPROVED','4b6be2ba-b7f1-4372-9a23-7e44b2351eae','2026-07-07 08:00:00','2026-07-08 09:45:00','4b6be2ba-b7f1-4372-9a23-7e44b2351eae','Approved for faith formation seminar.','APPROVED','10.0.0.5','192.168.1.11',NULL),
  ('VR-046','55617a21-df7d-4b2d-935f-59b7080fd861','Blessed Sacrament Chapel','Marian Devotion Prayer Gathering','Confirmed July devotional prayer gathering.','2026-07-18 15:00:00','2026-07-18 17:00:00',65,'Quiet seating and lectern.','[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'APPROVED','967c9939-4d9c-4939-b110-622188bd5c21','2026-07-14 10:00:00','2026-07-15 08:30:00','967c9939-4d9c-4939-b110-622188bd5c21','Approved for prayer gathering.','APPROVED','192.168.1.10','10.0.0.5',NULL),
  ('VR-047','562098e5-cf3f-439d-9fbb-51ec23ba9429','Socio Hall','Parish Youth Apostolate General Assembly','Confirmed August general assembly.','2026-08-08 08:00:00','2026-08-08 12:00:00',180,'Registration table, projector, and sound system.','[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'APPROVED','4b6be2ba-b7f1-4372-9a23-7e44b2351eae','2026-08-04 09:00:00','2026-08-05 09:00:00','4b6be2ba-b7f1-4372-9a23-7e44b2351eae','Approved for August assembly.','APPROVED','192.168.1.10','192.168.1.11',NULL),
  ('VR-048','fede3b1c-fbef-430a-8d5f-95e193c6709e','Meeting Room 1','Youth Ministry Planning Meeting','Confirmed August youth planning meeting.','2026-08-15 09:00:00','2026-08-15 10:30:00',16,NULL,'[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'APPROVED','967c9939-4d9c-4939-b110-622188bd5c21','2026-08-11 10:00:00','2026-08-12 08:45:00','967c9939-4d9c-4939-b110-622188bd5c21','Approved for planning meeting.','APPROVED','10.0.0.5','192.168.1.11',NULL),
  ('VR-049','55dbb026-1b2e-438f-9f16-d9d1722a5e9b','Mezzanine Hall A','Confirmation Class Session','Pending June confirmation class.','2026-06-09 13:00:00','2026-06-09 16:00:00',48,'Needs projector and whiteboard.','[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'PENDING',NULL,'2026-06-04 09:00:00','2026-06-04 09:00:00',NULL,NULL,NULL,'192.168.1.10',NULL,NULL),
  ('VR-050','86c940c9-27ac-4c26-8852-b8044eb90fd5','Parish Rectory','Parish Finance Committee Meeting','Pending youth finance coordination meeting.','2026-06-10 09:00:00','2026-06-10 10:30:00',20,NULL,'[]'::jsonb,'PENDING',NULL,'2026-06-05 08:30:00','2026-06-05 08:30:00',NULL,NULL,NULL,'10.0.0.5',NULL,NULL),
  ('VR-051','ef461726-1d29-42a4-94d9-68d9a99d1b18','Chapel of the Saints','Bible Sharing Session','Pending June bible sharing session.','2026-06-11 18:00:00','2026-06-11 20:00:00',38,NULL,'[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'PENDING',NULL,'2026-06-06 07:30:00','2026-06-06 07:30:00',NULL,NULL,NULL,'192.168.1.10',NULL,NULL),
  ('VR-052','d860f22d-95a4-4125-9fae-969ed2bbbd25','Mezzanine Hall (Whole A & B)','Altar Servers Formation Day','Pending July formation day request.','2026-07-10 08:00:00','2026-07-10 12:00:00',105,'Breakout tables and projector.','[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'PENDING',NULL,'2026-07-05 10:00:00','2026-07-05 10:00:00',NULL,NULL,NULL,'192.168.1.10',NULL,NULL),
  ('VR-053','562098e5-cf3f-439d-9fbb-51ec23ba9429','Socio Hall','Livelihood Seminar for Parishioners','Pending request that overlaps an approved Socio Hall retreat.','2026-06-12 10:00:00','2026-06-12 14:00:00',130,'Tables and projector requested.','[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'PENDING',NULL,'2026-06-07 09:00:00','2026-06-07 09:00:00',NULL,NULL,NULL,'10.0.0.5',NULL,'VR-041'),
  ('VR-054','f4ebfabd-a43c-425e-ba3d-7ce3f1f0e51d','Auditorium','Catholic Lay Apologetics Talk','Pending request that overlaps the high-attendance auditorium assembly.','2026-06-20 09:30:00','2026-06-20 12:30:00',280,'Auditorium sound system and projector.','[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'PENDING',NULL,'2026-06-15 09:00:00','2026-06-15 09:00:00',NULL,NULL,NULL,'192.168.1.10',NULL,'VR-042'),
  ('VR-055','0e41321c-ca02-480b-a46a-41c8f57654f9','Mezzanine Hall B','Music Ministry Choir Rehearsal','Pending request that overlaps an approved choir rehearsal.','2026-06-18 19:00:00','2026-06-18 20:00:00',45,NULL,'[{"type":"authorization_letter","url":"https://storage.example.com/letters/letter.pdf"}]'::jsonb,'PENDING',NULL,'2026-06-13 11:00:00','2026-06-13 11:00:00',NULL,NULL,NULL,'10.0.0.5',NULL,'VR-043')
), inserted_requests AS (
  INSERT INTO "VenueRequest" (
    id, "requesterId", "venueId", "ministryId", "eventName", purpose, "startDateTime", "endDateTime", attendees,
    "specialRequirements", attachments, signatures, status, "currentApproverId", "createdAt", "updatedAt"
  )
  SELECT
    gen_random_uuid(),
    'a86d11c3-9435-4fc5-bd76-7aa97d752b7b',
    venue_id,
    '042ad21d-3339-41be-b8d4-946711722308',
    event_name,
    purpose,
    start_at::timestamp,
    end_at::timestamp,
    attendees,
    special_requirements,
    attachments,
    '[]'::jsonb,
    status::"RequestStatus",
    current_approver_id,
    created_at::timestamp,
    updated_at::timestamp
  FROM seed_requests sr
  WHERE NOT EXISTS (
    SELECT 1 FROM "VenueRequest" vr
    WHERE vr."requesterId" = 'a86d11c3-9435-4fc5-bd76-7aa97d752b7b'
      AND vr."venueId" = sr.venue_id
      AND vr."eventName" = sr.event_name
      AND vr."startDateTime" = sr.start_at::timestamp
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING id, "venueId", "eventName", "startDateTime"
), all_seed_requests AS (
  SELECT sr.*, vr.id AS request_id
  FROM seed_requests sr
  JOIN "VenueRequest" vr
    ON vr."requesterId" = 'a86d11c3-9435-4fc5-bd76-7aa97d752b7b'
   AND vr."venueId" = sr.venue_id
   AND vr."eventName" = sr.event_name
   AND vr."startDateTime" = sr.start_at::timestamp
), inserted_approval_actions AS (
  INSERT INTO "ApprovalAction" (id, "requestId", "approverId", action, remarks, "createdAt")
  SELECT gen_random_uuid(), request_id, approver_id, decision_action::"ApprovalActionType", decision_remarks, updated_at::timestamp
  FROM all_seed_requests
  WHERE decision_action IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM "ApprovalAction" aa
      WHERE aa."requestId" = all_seed_requests.request_id
        AND aa.action = all_seed_requests.decision_action::"ApprovalActionType"
    )
  ON CONFLICT (id) DO NOTHING
  RETURNING id
), inserted_created_audits AS (
  INSERT INTO "AuditLog" (id, "requestId", "performedById", action, details, "ipAddress", "createdAt")
  SELECT
    gen_random_uuid(),
    request_id,
    'a86d11c3-9435-4fc5-bd76-7aa97d752b7b',
    'REQUEST_CREATED',
    jsonb_build_object('eventName', event_name, 'venue', venue_name, 'status', status, 'ministryId', '042ad21d-3339-41be-b8d4-946711722308'),
    submit_ip,
    created_at::timestamp
  FROM all_seed_requests
  WHERE NOT EXISTS (
    SELECT 1 FROM "AuditLog" al
    WHERE al."requestId" = all_seed_requests.request_id
      AND al.action = 'REQUEST_CREATED'
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING id
), inserted_decision_audits AS (
  INSERT INTO "AuditLog" (id, "requestId", "performedById", action, details, "ipAddress", "createdAt")
  SELECT
    gen_random_uuid(),
    request_id,
    approver_id,
    CASE decision_action
      WHEN 'APPROVED' THEN 'REQUEST_APPROVED'
      WHEN 'REJECTED' THEN 'REQUEST_REJECTED'
      WHEN 'REVISION_REQUESTED' THEN 'REQUEST_REVISION_REQUESTED'
    END,
    jsonb_build_object('eventName', event_name, 'venue', venue_name, 'status', status, 'remarks', decision_remarks),
    decision_ip,
    updated_at::timestamp
  FROM all_seed_requests
  WHERE decision_action IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM "AuditLog" al
      WHERE al."requestId" = all_seed_requests.request_id
        AND al.action = CASE all_seed_requests.decision_action
          WHEN 'APPROVED' THEN 'REQUEST_APPROVED'
          WHEN 'REJECTED' THEN 'REQUEST_REJECTED'
          WHEN 'REVISION_REQUESTED' THEN 'REQUEST_REVISION_REQUESTED'
        END
    )
  ON CONFLICT (id) DO NOTHING
  RETURNING id
), inserted_conflicts AS (
  INSERT INTO "SchedulingConflict" (id, "requestId", "conflictingRequestId", "detectedAt")
  SELECT gen_random_uuid(), pending.request_id, approved.request_id, pending.created_at::timestamp
  FROM all_seed_requests pending
  JOIN all_seed_requests approved ON approved.seed_key = pending.conflict_seed_key
  WHERE pending.conflict_seed_key IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM "SchedulingConflict" sc
      WHERE sc."requestId" = pending.request_id
        AND sc."conflictingRequestId" = approved.request_id
    )
  ON CONFLICT (id) DO NOTHING
  RETURNING id
)
SELECT
  (SELECT COUNT(*) FROM all_seed_requests) AS venue_requests_seeded_or_existing,
  (SELECT COUNT(*) FROM inserted_approval_actions) AS approval_actions_inserted,
  (SELECT COUNT(*) FROM inserted_created_audits) AS created_audits_inserted,
  (SELECT COUNT(*) FROM inserted_decision_audits) AS decision_audits_inserted,
  (SELECT COUNT(*) FROM inserted_conflicts) AS scheduling_conflicts_inserted;

COMMIT;
