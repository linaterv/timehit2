import math
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class CustomPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "per_page"
    page_query_param = "page"
    max_page_size = 100

    def get_paginated_response(self, data):
        total = self.page.paginator.count
        per_page = self.get_page_size(self.request) or self.page_size
        return Response({
            "data": data,
            "meta": {
                "page": self.page.number,
                "per_page": per_page,
                "total": total,
                "total_pages": math.ceil(total / per_page) if per_page else 1,
            },
        })

    def get_paginated_response_schema(self, schema):
        return {
            "type": "object",
            "properties": {
                "data": schema,
                "meta": {
                    "type": "object",
                    "properties": {
                        "page": {"type": "integer"},
                        "per_page": {"type": "integer"},
                        "total": {"type": "integer"},
                        "total_pages": {"type": "integer"},
                    },
                },
            },
        }
