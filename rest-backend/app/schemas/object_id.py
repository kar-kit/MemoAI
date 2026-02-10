# app/schemas/object_id.py
from bson import ObjectId
from pydantic import GetCoreSchemaHandler
from pydantic_core import core_schema


class PyObjectId(ObjectId):
    """
    Pydantic-compatible ObjectId type.
    Accepts either ObjectId or valid ObjectId string.
    """

    @classmethod
    def __get_pydantic_core_schema__(cls, source_type, handler: GetCoreSchemaHandler):
        return core_schema.union_schema(
            [
                core_schema.is_instance_schema(ObjectId),
                core_schema.no_info_plain_validator_function(cls.validate),
            ]
        )

    @classmethod
    def validate(cls, v):
        if isinstance(v, ObjectId):
            return v
        if isinstance(v, str) and ObjectId.is_valid(v):
            return ObjectId(v)
        raise ValueError("Invalid ObjectId")
