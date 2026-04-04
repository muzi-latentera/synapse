"""drop_scheduler_tables

Revision ID: 0606f53a291f
Revises: 42812b49a880
Create Date: 2026-04-03 21:18:51.471535

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from app.db.migration_helpers import uuid_server_default, now_server_default
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0606f53a291f'
down_revision: Union[str, None] = '42812b49a880'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index(op.f('idx_task_executions_status'), table_name='task_executions')
    op.drop_index(op.f('idx_task_executions_task_created'), table_name='task_executions')
    op.drop_table('task_executions')
    op.drop_index(op.f('idx_scheduled_tasks_status_next'), table_name='scheduled_tasks')
    op.drop_index(op.f('idx_scheduled_tasks_user_next'), table_name='scheduled_tasks')
    op.drop_index(op.f('ix_scheduled_tasks_next_execution'), table_name='scheduled_tasks')
    op.drop_table('scheduled_tasks')
    op.execute("DROP TYPE IF EXISTS taskexecutionstatus")
    op.execute("DROP TYPE IF EXISTS taskstatus")
    op.execute("DROP TYPE IF EXISTS recurrencetype")


def downgrade() -> None:
    op.create_table('scheduled_tasks',
    sa.Column('id', sa.UUID(), server_default=uuid_server_default(), autoincrement=False, nullable=False),
    sa.Column('user_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('task_name', sa.VARCHAR(length=255), autoincrement=False, nullable=False),
    sa.Column('prompt_message', sa.TEXT(), autoincrement=False, nullable=False),
    sa.Column('recurrence_type', postgresql.ENUM('once', 'daily', 'weekly', 'monthly', name='recurrencetype'), autoincrement=False, nullable=False),
    sa.Column('scheduled_time', sa.VARCHAR(length=8), autoincrement=False, nullable=False),
    sa.Column('scheduled_day', sa.INTEGER(), autoincrement=False, nullable=True),
    sa.Column('next_execution', postgresql.TIMESTAMP(timezone=True), autoincrement=False, nullable=True),
    sa.Column('status', postgresql.ENUM('pending', 'active', 'paused', 'completed', 'failed', name='taskstatus'), server_default=sa.text("'active'::taskstatus"), autoincrement=False, nullable=False),
    sa.Column('model_id', sa.VARCHAR(length=128), autoincrement=False, nullable=True),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=now_server_default(), autoincrement=False, nullable=False),
    sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), server_default=now_server_default(), autoincrement=False, nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('scheduled_tasks_user_id_fkey'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('scheduled_tasks_pkey'))
    )
    op.create_index(op.f('ix_scheduled_tasks_next_execution'), 'scheduled_tasks', ['next_execution'], unique=False)
    op.create_index(op.f('idx_scheduled_tasks_user_next'), 'scheduled_tasks', ['user_id', 'next_execution'], unique=False)
    op.create_index(op.f('idx_scheduled_tasks_status_next'), 'scheduled_tasks', ['status', 'next_execution'], unique=False)
    op.create_table('task_executions',
    sa.Column('id', sa.UUID(), server_default=uuid_server_default(), autoincrement=False, nullable=False),
    sa.Column('task_id', sa.UUID(), autoincrement=False, nullable=False),
    sa.Column('executed_at', postgresql.TIMESTAMP(timezone=True), autoincrement=False, nullable=False),
    sa.Column('completed_at', postgresql.TIMESTAMP(timezone=True), autoincrement=False, nullable=True),
    sa.Column('status', postgresql.ENUM('running', 'success', 'failed', name='taskexecutionstatus'), autoincrement=False, nullable=False),
    sa.Column('chat_id', sa.UUID(), autoincrement=False, nullable=True),
    sa.Column('error_message', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=now_server_default(), autoincrement=False, nullable=False),
    sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), server_default=now_server_default(), autoincrement=False, nullable=False),
    sa.ForeignKeyConstraint(['task_id'], ['scheduled_tasks.id'], name=op.f('task_executions_task_id_fkey'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('task_executions_pkey'))
    )
    op.create_index(op.f('idx_task_executions_task_created'), 'task_executions', ['task_id', 'created_at'], unique=False)
    op.create_index(op.f('idx_task_executions_status'), 'task_executions', ['status'], unique=False)
