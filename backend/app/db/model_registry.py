"""Imports every module's ORM models so they register on Base.metadata.

Alembic (and any create_all/drop_all call) must import this module before
inspecting metadata, otherwise tables defined in modules that were never
imported elsewhere would be invisible to migrations.
"""

from app.common import models as common_models  # noqa: F401
from app.modules.academic import models as academic_models  # noqa: F401
from app.modules.assets import models as assets_models  # noqa: F401
from app.modules.attendance import models as attendance_models  # noqa: F401
from app.modules.auth import models as auth_models  # noqa: F401
from app.modules.billing import models as billing_models  # noqa: F401
from app.modules.communication import models as communication_models  # noqa: F401
from app.modules.exams import models as exams_models  # noqa: F401
from app.modules.expenses import models as expenses_models  # noqa: F401
from app.modules.guardians import models as guardians_models  # noqa: F401
from app.modules.omr import models as omr_models  # noqa: F401
from app.modules.payroll import models as payroll_models  # noqa: F401
from app.modules.results import models as results_models  # noqa: F401
from app.modules.routine import models as routine_models  # noqa: F401
from app.modules.students import models as students_models  # noqa: F401
from app.modules.teachers import models as teachers_models  # noqa: F401
from app.modules.users import models as users_models  # noqa: F401
