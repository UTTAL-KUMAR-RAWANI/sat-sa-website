import logging
from app.core.database import SessionLocal
from app.models.identity import Role, Permission
from app.rbac.permissions import ALL_PERMISSIONS
from app.rbac.mappings import ROLE_DEFINITIONS

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sync_permissions")

def sync_rbac_permissions():
    db = SessionLocal()
    try:
        # 1. Ensure all permissions exist in database
        perms_dict = {}
        added_perms = 0
        for perm_name in ALL_PERMISSIONS:
            perm = db.query(Permission).filter(Permission.name == perm_name).first()
            if not perm:
                perm = Permission(name=perm_name, description=f"Permission to {perm_name}")
                db.add(perm)
                db.flush()
                added_perms += 1
            perms_dict[perm_name] = perm
        logger.info(f"Permissions checked. Added {added_perms} new permissions.")

        # 2. Sync role permissions
        added_role_perms = 0
        for role_name, role_info in ROLE_DEFINITIONS.items():
            role = db.query(Role).filter(Role.name == role_name).first()
            if not role:
                logger.warning(f"Role '{role_name}' not found in database, skipping.")
                continue
            
            current_perms = set(p.name for p in role.permissions)
            for perm_name in role_info.get("permissions", []):
                if perm_name in perms_dict and perm_name not in current_perms:
                    role.permissions.append(perms_dict[perm_name])
                    added_role_perms += 1
            db.flush()

        db.commit()
        logger.info(f"RBAC sync complete. Attached {added_role_perms} role-permission mappings.")
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to sync permissions: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    sync_rbac_permissions()
