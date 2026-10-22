-- YeGo MySQL 8 initial schema (work in progress).
-- This migration is isolated from the PostgreSQL migration directory.
-- Do not run against a database containing production records.
SET NAMES utf8mb4;
CREATE TABLE IF NOT EXISTS schema_migrations (
 version VARCHAR(190) PRIMARY KEY,
 checksum CHAR(64) NOT NULL,
 applied_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS states (
 code VARCHAR(8) PRIMARY KEY,
 name VARCHAR(190) NOT NULL UNIQUE,
 capital VARCHAR(190) NOT NULL,
 zone VARCHAR(100) NOT NULL,
 lat DOUBLE NOT NULL,
 lng DOUBLE NOT NULL,
 polling_units INT NOT NULL DEFAULT 0,
 wards INT NOT NULL DEFAULT 0,
 CONSTRAINT chk_states_units CHECK (polling_units >= 0),
 CONSTRAINT chk_states_wards CHECK (wards >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lgas (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 state_code VARCHAR(8) NOT NULL,
 name VARCHAR(190) NOT NULL,
 UNIQUE KEY uq_lga_state_name (state_code, name),
 CONSTRAINT fk_lgas_state FOREIGN KEY (state_code) REFERENCES states(code) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS polling_units (
 id CHAR(36) PRIMARY KEY,
 state_code VARCHAR(8) NOT NULL,
 lga VARCHAR(190) NOT NULL,
 ward VARCHAR(190) NOT NULL,
 code VARCHAR(190) NOT NULL UNIQUE,
 name TEXT NOT NULL,
 lat DOUBLE NULL,
 lng DOUBLE NULL,
 source VARCHAR(100) NOT NULL DEFAULT 'manual',
 verified BOOLEAN NOT NULL DEFAULT FALSE,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 KEY idx_polling_geo (state_code, lga, ward),
 CONSTRAINT fk_polling_state FOREIGN KEY (state_code) REFERENCES states(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS applications (
 id CHAR(36) PRIMARY KEY,
 public_id VARCHAR(100) NOT NULL UNIQUE,
 yego_id VARCHAR(100) UNIQUE,
 full_name TEXT NOT NULL,
 gender VARCHAR(20) NOT NULL,
 date_of_birth DATE NOT NULL,
 phone VARCHAR(50) NOT NULL,
 whatsapp VARCHAR(50) NOT NULL,
 email VARCHAR(254) NOT NULL,
 nin_ciphertext LONGTEXT NULL,
 nin_last4 VARCHAR(4) NULL,
 state_of_origin VARCHAR(190) NOT NULL,
 state_of_residence VARCHAR(190) NOT NULL,
 lga VARCHAR(190) NOT NULL,
 ward VARCHAR(190) NOT NULL,
 preferred_polling_unit TEXT NULL,
 polling_unit TEXT NOT NULL,
 background LONGTEXT NOT NULL,
 experience LONGTEXT NOT NULL,
 photo_data LONGTEXT NULL,
 status VARCHAR(50) NOT NULL DEFAULT 'Application Submitted',
 whatsapp_confirmed_at DATETIME(3) NULL,
 training_progress INT NOT NULL DEFAULT 0,
 submitted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 KEY idx_app_status (status),
 KEY idx_app_geo (state_of_residence, lga),
 KEY idx_app_phone (phone),
 KEY idx_app_submitted (submitted_at),
 CONSTRAINT chk_app_gender CHECK (gender IN ('Female','Male')),
 CONSTRAINT chk_app_progress CHECK (training_progress BETWEEN 0 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
 id CHAR(36) PRIMARY KEY,
 email VARCHAR(254) NOT NULL,
 password_hash TEXT NOT NULL,
 name TEXT NOT NULL,
 role VARCHAR(100) NOT NULL,
 kind VARCHAR(20) NOT NULL,
 scope_kind VARCHAR(20) NOT NULL,
 scope_zone VARCHAR(100) NULL,
 scope_state VARCHAR(190) NULL,
 scope_lga VARCHAR(190) NULL,
 application_id CHAR(36) NULL UNIQUE,
 active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 UNIQUE KEY uq_users_email (email),
 CONSTRAINT fk_users_application FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
 id CHAR(36) PRIMARY KEY,
 user_id CHAR(36) NOT NULL,
 token_hash VARCHAR(190) NOT NULL UNIQUE,
 expires_at DATETIME(3) NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 last_seen_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 ip VARCHAR(100) NULL,
 user_agent TEXT NULL,
 KEY idx_session_user (user_id),
 KEY idx_session_expiry (expires_at),
 CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS login_attempts (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 email VARCHAR(254) NOT NULL,
 ip VARCHAR(100) NULL,
 success BOOLEAN NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 KEY idx_login_email_time (email, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS application_history (
 id CHAR(36) PRIMARY KEY,
 application_id CHAR(36) NOT NULL,
 action VARCHAR(190) NOT NULL,
 from_status VARCHAR(100) NULL,
 to_status VARCHAR(100) NULL,
 note LONGTEXT NULL,
 actor_user_id CHAR(36) NULL,
 actor_label VARCHAR(190) NOT NULL DEFAULT 'System',
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 KEY idx_app_history (application_id, created_at),
 CONSTRAINT fk_app_history_application FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS consent_records (
 id CHAR(36) PRIMARY KEY,
 application_id CHAR(36) NOT NULL,
 kind VARCHAR(100) NOT NULL,
 version VARCHAR(50) NOT NULL,
 accepted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 ip VARCHAR(100) NULL,
 user_agent TEXT NULL,
 CONSTRAINT fk_consent_application FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_log (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 actor_user_id CHAR(36) NULL,
 actor_label VARCHAR(190) NOT NULL DEFAULT 'System',
 action VARCHAR(190) NOT NULL,
 entity_type VARCHAR(190) NULL,
 entity_id VARCHAR(190) NULL,
 outcome VARCHAR(50) NOT NULL DEFAULT 'success',
 detail JSON NULL,
 ip VARCHAR(100) NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 KEY idx_audit_time (created_at),
 KEY idx_audit_lookup (action, ip, created_at),
 CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS yego_counters (
 name VARCHAR(100) PRIMARY KEY,
 next_value BIGINT UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT IGNORE INTO yego_counters (name,next_value) VALUES
 ('application_ref_seq',260000),('incident_ref_seq',1000),
 ('warning_ref_seq',100),('certificate_ref_seq',1001);
