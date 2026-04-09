import React from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

const EditProfileModal = ({ show, onClose, userName, userEmail, setUserName, setUserEmail, userCountry, setUserCountry, profileImage, setProfileImage }) => {

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setProfileImage(result.assets[0].uri);
    }
  };
  if (!show) return null;

  return (
    <View style={styles.editProfileOverlay}>
      <View style={styles.editProfileCard}>
        <View style={styles.editProfileHeader}>
          <Text style={styles.editProfileTitle}>Edit Profile</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={{ color: '#999', fontSize: 16 }}>{'✕'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.avatarPickerRow} onPress={pickImage}>
          {profileImage ? (
            <Image source={{ uri: profileImage }} style={styles.avatarPickerImage} />
          ) : (
            <View style={styles.avatarPickerCircle}>
              <Text style={styles.avatarPickerInitial}>{userName.charAt(0)}</Text>
            </View>
          )}
          <Text style={styles.avatarPickerText}>Change photo</Text>
        </TouchableOpacity>

        <View style={styles.editProfileField}>
          <Text style={styles.editProfileLabel}>Name</Text>
          <TextInput style={styles.editProfileInput} value={userName} onChangeText={setUserName} />
        </View>

        <TouchableOpacity style={styles.editProfileSaveBtn} onPress={onClose}>
          <Text style={styles.editProfileSaveBtnText}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  editProfileOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 20,
  },
  editProfileCard: {
    width: '85%',
    maxWidth: 320,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
  },
  editProfileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  editProfileTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  editProfileClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 16,
    color: '#666',
  },
  editProfileAvatarSection: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  editProfileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editProfileAvatarInitial: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  editProfileAvatarBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
    borderRadius: 8,
  },
  editProfileAvatarBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  editProfileForm: {
    flexDirection: 'column',
    gap: 16,
    marginBottom: 24,
  },
  avatarPickerRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarPickerCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPickerInitial: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  avatarPickerImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPickerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
    marginTop: 6,
  },
  editProfileField: {
    marginBottom: 12,
  },
  editProfileLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    marginBottom: 4,
  },
  editProfileInput: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    fontSize: 14,
    color: '#1F1F1F',
  },
  editProfileSaveBtn: {
    width: '100%',
    paddingVertical: 12,
    backgroundColor: '#059669',
    borderRadius: 24,
    alignItems: 'center',
    marginTop: 4,
  },
  editProfileSaveBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});

export default EditProfileModal;
