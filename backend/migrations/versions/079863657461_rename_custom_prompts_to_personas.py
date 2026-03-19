"""rename custom_prompts to personas

Revision ID: 079863657461
Revises: 852cfc68e9d3
Create Date: 2026-03-19 00:01:09.378673

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '079863657461'
down_revision: Union[str, None] = '852cfc68e9d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('user_settings', 'custom_prompts', new_column_name='personas')


def downgrade() -> None:
    op.alter_column('user_settings', 'personas', new_column_name='custom_prompts')
