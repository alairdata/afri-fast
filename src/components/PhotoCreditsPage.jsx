import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal, Platform, Linking } from 'react-native';
import { PHOTO_CREDITS } from '../lib/photoCredits';

const INK = '#16201b';
const INK500 = '#6c7872';
const INK400 = '#97a19b';
const LINE = '#e9e9e1';
const GREEN = '#059669';

const openUrl = (url) => url && Linking.openURL(url).catch(() => {});

// "Photo credits": who took each food and article photo and the licence it's used under
// (Creative Commons BY / BY-SA need attribution; public domain and CC0 are listed for completeness).
const PhotoCreditsPage = ({ visible, onClose }) => (
  <Modal
    visible={!!visible}
    animationType="slide"
    presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
    onRequestClose={onClose}
  >
    <View style={[styles.page, Platform.OS === 'android' && { paddingTop: 44 }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close">
          <Ionicons name="close" size={22} color={INK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Photo credits</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Food and article photos in Logga are by these photographers, used under the licences shown. Photos may be cropped or resized. Tap a credit to see the original.
        </Text>
        <View style={styles.card}>
          {PHOTO_CREDITS.map((c, i) => (
            <TouchableOpacity
              key={c.file}
              style={[styles.row, i === PHOTO_CREDITS.length - 1 && { borderBottomWidth: 0 }]}
              onPress={() => openUrl(c.page)}
              activeOpacity={0.7}
              accessibilityRole="link"
            >
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.what}>{c.what}</Text>
                <Text style={styles.by}>
                  {c.title ? `"${c.title}" by ` : 'By '}{c.author}
                </Text>
                <Text
                  style={styles.lic}
                  onPress={c.license_url ? () => openUrl(c.license_url) : undefined}
                >
                  {c.license}
                </Text>
              </View>
              <Ionicons name="open-outline" size={16} color={GREEN} />
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: INK },
  content: { paddingHorizontal: 20, paddingTop: 18, width: '100%', maxWidth: 640, alignSelf: 'center' },
  intro: { fontSize: 14.5, lineHeight: 21, color: INK500, marginBottom: 14 },
  card: { borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: LINE, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: LINE },
  what: { fontSize: 13.5, fontWeight: '700', color: INK },
  by: { fontSize: 12.5, lineHeight: 17, color: INK500, marginTop: 2 },
  lic: { fontSize: 12, color: INK400, marginTop: 2, textDecorationLine: 'underline' },
});

export default PhotoCreditsPage;
