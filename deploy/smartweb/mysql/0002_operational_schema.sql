-- MySQL 8 additions for YeGo's operational modules.
-- Requires 0001_core_schema.sql first. WIP, untested against production.
SET NAMES utf8mb4;
CREATE TABLE IF NOT EXISTS incidents (
 id CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
 public_id VARCHAR(100) NOT NULL UNIQUE,
 type VARCHAR(190) NOT NULL,
 description LONGTEXT NOT NULL,
 severity VARCHAR(20) NOT NULL,
 state VARCHAR(190) NOT NULL,
 lga VARCHAR(190) NOT NULL,
 ward VARCHAR(190) NOT NULL,
 polling_unit TEXT NOT NULL,
 lat DOUBLE NOT NULL,
 lng DOUBLE NOT NULL,
 occurred_at DATETIME(3) NOT NULL,
 reported_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 reporter_name TEXT NOT NULL,
 reporter_id VARCHAR(190) NOT NULL,
 reporter_user_id CHAR(36) NULL,
 status VARCHAR(50) NOT NULL DEFAULT 'Reported',
 category VARCHAR(190) NULL,
 election_day BOOLEAN NOT NULL DEFAULT FALSE,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 KEY idx_incident_status (status),
 KEY idx_incident_geo (state,lga),
 KEY idx_incident_reported (reported_at),
 KEY idx_incident_reporter (reporter_user_id),
 CONSTRAINT fk_incident_reporter FOREIGN KEY (reporter_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS incident_evidence (
 id CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
 incident_id CHAR(36) NOT NULL,
 kind VARCHAR(20) NOT NULL,
 file_name TEXT NOT NULL,
 storage_key TEXT NULL,
 mime_type VARCHAR(190) NULL,
 byte_size BIGINT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 CONSTRAINT fk_evidence_incident FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS incident_history (
 id CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
 incident_id CHAR(36) NOT NULL,
 action VARCHAR(190) NOT NULL,
 from_status VARCHAR(100) NULL,
 to_status VARCHAR(100) NULL,
 note LONGTEXT NULL,
 actor_user_id CHAR(36) NULL,
 actor_label VARCHAR(190) NOT NULL DEFAULT 'System',
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 KEY idx_incident_history (incident_id,created_at),
 CONSTRAINT fk_incident_history FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS incident_referrals (
 id CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
 incident_id CHAR(36) NOT NULL,
 agency_code VARCHAR(100) NOT NULL,
 agency_name VARCHAR(190) NOT NULL,
 note LONGTEXT NULL,
 status VARCHAR(50) NOT NULL DEFAULT 'pending_manual',
 created_by CHAR(36) NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 KEY idx_referral_incident (incident_id),
 CONSTRAINT fk_referral_incident FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE,
 CONSTRAINT fk_referral_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS referral_events (
 id CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
 referral_id CHAR(36) NOT NULL,
 event VARCHAR(190) NOT NULL,
 detail LONGTEXT NULL,
 actor_user_id CHAR(36) NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 CONSTRAINT fk_referral_event FOREIGN KEY (referral_id) REFERENCES incident_referrals(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS early_warnings (
 id CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
 public_id VARCHAR(100) NOT NULL UNIQUE,
 type VARCHAR(190) NOT NULL,
 title TEXT NOT NULL,
 summary LONGTEXT NOT NULL,
 state VARCHAR(190) NOT NULL,
 lga VARCHAR(190) NOT NULL,
 level VARCHAR(20) NOT NULL DEFAULT 'Watch',
 access VARCHAR(50) NOT NULL DEFAULT 'Command only',
 raised_by_user_id CHAR(36) NULL,
 raised_by_label VARCHAR(190) NOT NULL,
 evidence_count INT NOT NULL DEFAULT 0,
 lat DOUBLE NOT NULL,
 lng DOUBLE NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 KEY idx_warning_geo (state,lga),
 KEY idx_warning_created (created_at),
 CONSTRAINT fk_warning_user FOREIGN KEY (raised_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS training_attempts (
 id CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
 application_id CHAR(36) NOT NULL,
 module_id VARCHAR(190) NOT NULL,
 answers JSON NOT NULL,
 score INT NOT NULL DEFAULT 0,
 passed BOOLEAN NOT NULL DEFAULT FALSE,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 KEY idx_training_app (application_id,created_at),
 CONSTRAINT fk_training_app FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS certificates (
 id CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
 application_id CHAR(36) NOT NULL UNIQUE,
 certificate_no VARCHAR(190) NOT NULL UNIQUE,
 issued_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 issued_by CHAR(36) NULL,
 CONSTRAINT fk_certificate_app FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
 CONSTRAINT fk_certificate_user FOREIGN KEY (issued_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS check_ins (
 id CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
 application_id CHAR(36) NOT NULL,
 polling_unit TEXT NOT NULL,
 lat DOUBLE NULL,
 lng DOUBLE NULL,
 checked_in_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 KEY idx_checkin_app (application_id,checked_in_at),
 CONSTRAINT fk_checkin_app FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS announcements (
 id CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
 from_label VARCHAR(190) NOT NULL,
 tier VARCHAR(100) NOT NULL,
 kind VARCHAR(100) NOT NULL,
 title TEXT NOT NULL,
 body LONGTEXT NOT NULL,
 audience TEXT NOT NULL,
 created_by CHAR(36) NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 KEY idx_announcement_created (created_at),
 CONSTRAINT fk_announcement_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS notifications (
 id CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
 user_id CHAR(36) NOT NULL,
 kind VARCHAR(100) NOT NULL,
 title TEXT NOT NULL,
 body LONGTEXT NOT NULL,
 entity_type VARCHAR(100) NULL,
 entity_id VARCHAR(190) NULL,
 read_at DATETIME(3) NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 KEY idx_notification_user (user_id,created_at),
 KEY idx_notification_unread (user_id,read_at),
 CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS settings (
 `key` VARCHAR(190) PRIMARY KEY,
 `value` JSON NOT NULL,
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
