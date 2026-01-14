from django.contrib.auth import get_user_model
from rest_framework import serializers
from .models import (
	DonorProfile,
	EmergencyNeed,
	OrganDonor,
	MarketplaceItem,
	Hospital,
	Doctor,
	Review,
)


User = get_user_model()


class UserPublicSerializer(serializers.ModelSerializer):
	class Meta:
		model = User
		fields = ["id", "username", "first_name", "last_name"]


class DonorProfileSerializer(serializers.ModelSerializer):
	user = UserPublicSerializer(read_only=True)
	user_id = serializers.PrimaryKeyRelatedField(source="user", write_only=True, queryset=User.objects.all(), required=True)

	class Meta:
		model = DonorProfile
		fields = [
			"id",
			"user",
			"user_id",
			"blood_group",
			"city",
			"zip_code",
			"is_platelet_donor",
			"last_donated_on",
			"phone",
			"is_available",
			"created_at",
			"updated_at",
		]
		read_only_fields = ["created_at", "updated_at"]


class EmergencyNeedSerializer(serializers.ModelSerializer):
	created_by = UserPublicSerializer(read_only=True)
	created_by_id = serializers.PrimaryKeyRelatedField(source="created_by", write_only=True, queryset=User.objects.all(), required=True)

	class Meta:
		model = EmergencyNeed
		fields = [
			"id",
			"title",
			"description",
			"need_type",
			"required_blood_group",
			"city",
			"zip_code",
			"contact_phone",
			"status",
			"needed_by",
			"created_by",
			"created_by_id",
			"created_at",
			"updated_at",
		]
		read_only_fields = ["created_at", "updated_at"]


class OrganDonorSerializer(serializers.ModelSerializer):
	user = UserPublicSerializer(read_only=True)
	user_id = serializers.PrimaryKeyRelatedField(source="user", write_only=True, queryset=User.objects.all(), required=True)

	class Meta:
		model = OrganDonor
		fields = [
			"id",
			"user",
			"user_id",
			"organs",
			"city",
			"zip_code",
			"consent_provided",
			"created_at",
			"updated_at",
		]
		read_only_fields = ["created_at", "updated_at"]


class HospitalSerializer(serializers.ModelSerializer):
	class Meta:
		model = Hospital
		fields = [
			"id",
			"name",
			"city",
			"zip_code",
			"address",
			"phone",
			"website",
			"created_at",
			"updated_at",
		]
		read_only_fields = ["created_at", "updated_at"]


class DoctorSerializer(serializers.ModelSerializer):
	hospital = HospitalSerializer(read_only=True)
	hospital_id = serializers.PrimaryKeyRelatedField(source="hospital", write_only=True, queryset=Hospital.objects.all(), allow_null=True, required=False)

	class Meta:
		model = Doctor
		fields = [
			"id",
			"name",
			"specialization",
			"hospital",
			"hospital_id",
			"phone",
			"created_at",
			"updated_at",
		]
		read_only_fields = ["created_at", "updated_at"]


class ReviewSerializer(serializers.ModelSerializer):
	user = UserPublicSerializer(read_only=True)
	user_id = serializers.PrimaryKeyRelatedField(source="user", write_only=True, queryset=User.objects.all(), required=True)
	hospital = HospitalSerializer(read_only=True)
	hospital_id = serializers.PrimaryKeyRelatedField(source="hospital", write_only=True, queryset=Hospital.objects.all(), allow_null=True, required=False)
	doctor = DoctorSerializer(read_only=True)
	doctor_id = serializers.PrimaryKeyRelatedField(source="doctor", write_only=True, queryset=Doctor.objects.all(), allow_null=True, required=False)

	class Meta:
		model = Review
		fields = [
			"id",
			"user",
			"user_id",
			"hospital",
			"hospital_id",
			"doctor",
			"doctor_id",
			"rating",
			"comment",
			"is_moderated",
			"created_at",
			"updated_at",
		]
		read_only_fields = ["created_at", "updated_at", "is_moderated"]


class MarketplaceItemSerializer(serializers.ModelSerializer):
	seller = UserPublicSerializer(read_only=True)
	seller_id = serializers.PrimaryKeyRelatedField(source="seller", write_only=True, queryset=User.objects.all(), required=True)

	class Meta:
		model = MarketplaceItem
		fields = [
			"id",
			"seller",
			"seller_id",
			"title",
			"description",
			"category",
			"price_cents",
			"currency",
			"city",
			"zip_code",
			"quantity_available",
			"is_active",
			"created_at",
			"updated_at",
		]
		read_only_fields = ["created_at", "updated_at"]


