"""add datasets and analytics pipeline tables

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-09-13 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


# revision identifiers, used by Alembic.
revision = 'f6a7b8c9d0e1'
down_revision = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Upgrade datasets table
    op.add_column('datasets', sa.Column('business_id', sa.String(), nullable=True))
    op.create_index('ix_datasets_business_id', 'datasets', ['business_id'], unique=True)
    
    op.add_column('datasets', sa.Column('source_type', sa.String(), server_default='SIEM', nullable=False))
    op.add_column('datasets', sa.Column('file_name', sa.String(), server_default='', nullable=False))
    op.add_column('datasets', sa.Column('file_type', sa.String(), server_default='CSV', nullable=False))
    op.add_column('datasets', sa.Column('file_size', sa.BigInteger(), server_default='0', nullable=False))
    op.add_column('datasets', sa.Column('file_hash', sa.String(), server_default='', nullable=False))
    op.create_index('ix_datasets_file_hash', 'datasets', ['file_hash'])
    
    op.add_column('datasets', sa.Column('storage_path', sa.String(), server_default='', nullable=False))
    op.add_column('datasets', sa.Column('uploaded_by_id', sa.Uuid(), nullable=True))
    op.create_foreign_key('fk_datasets_uploaded_by_id', 'datasets', 'users', ['uploaded_by_id'], ['id'])
    
    op.add_column('datasets', sa.Column('organization_id', sa.Uuid(), nullable=True))
    op.create_foreign_key('fk_datasets_organization_id', 'datasets', 'organizations', ['organization_id'], ['id'])
    
    op.add_column('datasets', sa.Column('sector_id', sa.Uuid(), nullable=True))
    op.create_foreign_key('fk_datasets_sector_id', 'datasets', 'sectors', ['sector_id'], ['id'])
    
    op.add_column('datasets', sa.Column('related_cse_id', sa.Uuid(), nullable=True))
    op.create_foreign_key('fk_datasets_related_cse_id', 'datasets', 'cses', ['related_cse_id'], ['id'])
    
    op.add_column('datasets', sa.Column('status', sa.String(), server_default='UPLOADED', nullable=False))
    op.add_column('datasets', sa.Column('record_count', sa.Integer(), server_default='0', nullable=False))
    op.add_column('datasets', sa.Column('valid_record_count', sa.Integer(), server_default='0', nullable=False))
    op.add_column('datasets', sa.Column('invalid_record_count', sa.Integer(), server_default='0', nullable=False))
    op.add_column('datasets', sa.Column('warning_count', sa.Integer(), server_default='0', nullable=False))
    op.add_column('datasets', sa.Column('duplicate_count', sa.Integer(), server_default='0', nullable=False))
    
    op.add_column('datasets', sa.Column('detected_schema', JSONB, nullable=True))
    op.add_column('datasets', sa.Column('column_mapping', JSONB, nullable=True))
    op.add_column('datasets', sa.Column('validation_summary', JSONB, nullable=True))
    op.add_column('datasets', sa.Column('quality_score', sa.Float(), nullable=True))
    op.add_column('datasets', sa.Column('quality_rating', sa.String(), nullable=True))
    op.add_column('datasets', sa.Column('error_message', sa.Text(), nullable=True))

    # 2. Upgrade dataset_imports table
    op.add_column('dataset_imports', sa.Column('business_id', sa.String(), nullable=True))
    op.create_index('ix_dataset_imports_business_id', 'dataset_imports', ['business_id'], unique=True)
    
    op.add_column('dataset_imports', sa.Column('started_by_id', sa.Uuid(), nullable=True))
    op.create_foreign_key('fk_dataset_imports_started_by_id', 'dataset_imports', 'users', ['started_by_id'], ['id'])
    
    op.add_column('dataset_imports', sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.add_column('dataset_imports', sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True))
    
    op.add_column('dataset_imports', sa.Column('records_processed', sa.Integer(), server_default='0', nullable=False))
    op.add_column('dataset_imports', sa.Column('records_imported', sa.Integer(), server_default='0', nullable=False))
    op.add_column('dataset_imports', sa.Column('records_rejected', sa.Integer(), server_default='0', nullable=False))
    op.add_column('dataset_imports', sa.Column('error_count', sa.Integer(), server_default='0', nullable=False))
    
    op.add_column('dataset_imports', sa.Column('validation_summary', JSONB, nullable=True))
    op.add_column('dataset_imports', sa.Column('import_summary', JSONB, nullable=True))
    op.add_column('dataset_imports', sa.Column('error_log', JSONB, nullable=True))

    # 3. Upgrade analytics_runs table
    op.add_column('analytics_runs', sa.Column('business_id', sa.String(), nullable=True))
    op.create_index('ix_analytics_runs_business_id', 'analytics_runs', ['business_id'], unique=True)
    
    op.add_column('analytics_runs', sa.Column('initiated_by_id', sa.Uuid(), nullable=True))
    op.create_foreign_key('fk_analytics_runs_initiated_by_id', 'analytics_runs', 'users', ['initiated_by_id'], ['id'])
    
    op.add_column('analytics_runs', sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.add_column('analytics_runs', sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('analytics_runs', sa.Column('records_analyzed', sa.Integer(), server_default='0', nullable=False))
    op.add_column('analytics_runs', sa.Column('results_summary', JSONB, nullable=True))
    op.add_column('analytics_runs', sa.Column('error_message', sa.Text(), nullable=True))

    # 4. Upgrade security_events table
    op.add_column('security_events', sa.Column('dataset_id', sa.Uuid(), nullable=True))
    op.create_foreign_key('fk_security_events_dataset_id', 'security_events', 'datasets', ['dataset_id'], ['id'])
    op.create_index('ix_security_events_dataset_id', 'security_events', ['dataset_id'])
    
    op.add_column('security_events', sa.Column('dataset_import_id', sa.Uuid(), nullable=True))
    op.create_foreign_key('fk_security_events_dataset_import_id', 'security_events', 'dataset_imports', ['dataset_import_id'], ['id'])
    op.create_index('ix_security_events_dataset_import_id', 'security_events', ['dataset_import_id'])
    
    op.add_column('security_events', sa.Column('external_event_id', sa.String(), nullable=True))
    op.add_column('security_events', sa.Column('occurred_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index('ix_security_events_occurred_at', 'security_events', ['occurred_at'])
    
    op.add_column('security_events', sa.Column('source_ip', sa.String(), nullable=True))
    op.add_column('security_events', sa.Column('destination_ip', sa.String(), nullable=True))
    op.add_column('security_events', sa.Column('asset_id', sa.String(), nullable=True))
    op.add_column('security_events', sa.Column('user_identifier', sa.String(), nullable=True))
    op.add_column('security_events', sa.Column('action', sa.String(), nullable=True))
    op.add_column('security_events', sa.Column('status', sa.String(), server_default='OBSERVED', nullable=False))


def downgrade() -> None:
    # Downgrade security_events
    op.drop_index('ix_security_events_occurred_at', table_name='security_events')
    op.drop_index('ix_security_events_dataset_import_id', table_name='security_events')
    op.drop_index('ix_security_events_dataset_id', table_name='security_events')
    op.drop_constraint('fk_security_events_dataset_import_id', 'security_events', type_='foreignkey')
    op.drop_constraint('fk_security_events_dataset_id', 'security_events', type_='foreignkey')
    op.drop_column('security_events', 'status')
    op.drop_column('security_events', 'action')
    op.drop_column('security_events', 'user_identifier')
    op.drop_column('security_events', 'asset_id')
    op.drop_column('security_events', 'destination_ip')
    op.drop_column('security_events', 'source_ip')
    op.drop_column('security_events', 'occurred_at')
    op.drop_column('security_events', 'external_event_id')
    op.drop_column('security_events', 'dataset_import_id')
    op.drop_column('security_events', 'dataset_id')

    # Downgrade analytics_runs
    op.drop_constraint('fk_analytics_runs_initiated_by_id', 'analytics_runs', type_='foreignkey')
    op.drop_index('ix_analytics_runs_business_id', table_name='analytics_runs')
    op.drop_column('analytics_runs', 'error_message')
    op.drop_column('analytics_runs', 'results_summary')
    op.drop_column('analytics_runs', 'records_analyzed')
    op.drop_column('analytics_runs', 'completed_at')
    op.drop_column('analytics_runs', 'started_at')
    op.drop_column('analytics_runs', 'initiated_by_id')
    op.drop_column('analytics_runs', 'business_id')

    # Downgrade dataset_imports
    op.drop_constraint('fk_dataset_imports_started_by_id', 'dataset_imports', type_='foreignkey')
    op.drop_index('ix_dataset_imports_business_id', table_name='dataset_imports')
    op.drop_column('dataset_imports', 'error_log')
    op.drop_column('dataset_imports', 'import_summary')
    op.drop_column('dataset_imports', 'validation_summary')
    op.drop_column('dataset_imports', 'error_count')
    op.drop_column('dataset_imports', 'records_rejected')
    op.drop_column('dataset_imports', 'records_imported')
    op.drop_column('dataset_imports', 'records_processed')
    op.drop_column('dataset_imports', 'completed_at')
    op.drop_column('dataset_imports', 'started_at')
    op.drop_column('dataset_imports', 'started_by_id')
    op.drop_column('dataset_imports', 'business_id')

    # Downgrade datasets
    op.drop_constraint('fk_datasets_related_cse_id', 'datasets', type_='foreignkey')
    op.drop_constraint('fk_datasets_sector_id', 'datasets', type_='foreignkey')
    op.drop_constraint('fk_datasets_organization_id', 'datasets', type_='foreignkey')
    op.drop_constraint('fk_datasets_uploaded_by_id', 'datasets', type_='foreignkey')
    op.drop_index('ix_datasets_file_hash', table_name='datasets')
    op.drop_index('ix_datasets_business_id', table_name='datasets')
    op.drop_column('datasets', 'error_message')
    op.drop_column('datasets', 'quality_rating')
    op.drop_column('datasets', 'quality_score')
    op.drop_column('datasets', 'validation_summary')
    op.drop_column('datasets', 'column_mapping')
    op.drop_column('datasets', 'detected_schema')
    op.drop_column('datasets', 'duplicate_count')
    op.drop_column('datasets', 'warning_count')
    op.drop_column('datasets', 'invalid_record_count')
    op.drop_column('datasets', 'valid_record_count')
    op.drop_column('datasets', 'record_count')
    op.drop_column('datasets', 'status')
    op.drop_column('datasets', 'related_cse_id')
    op.drop_column('datasets', 'sector_id')
    op.drop_column('datasets', 'organization_id')
    op.drop_column('datasets', 'uploaded_by_id')
    op.drop_column('datasets', 'storage_path')
    op.drop_column('datasets', 'file_hash')
    op.drop_column('datasets', 'file_size')
    op.drop_column('datasets', 'file_type')
    op.drop_column('datasets', 'file_name')
    op.drop_column('datasets', 'source_type')
    op.drop_column('datasets', 'business_id')
