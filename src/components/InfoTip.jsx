import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Pressable, ScrollView } from 'react-native';
import { INSIGHT_HELP } from '../lib/insightHelp';

// Small (i) next to a card title. Tapping it opens a short plain-language explanation of the card.
const InfoTip = ({ id, color = '#9CA3AF', size = 15, style }) => {
  const [open, setOpen] = useState(false);
  const help = INSIGHT_HELP[id];
  if (!help) return null;
  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={[styles.btn, style]}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel={`What is ${help.title}?`}
      >
        <Ionicons name="information-circle-outline" size={size} color={color} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.headRow}>
              <Ionicons name="information-circle" size={20} color="#059669" />
              <Text style={styles.title}>{help.title}</Text>
            </View>
            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.body}>{help.body}</Text>
            </ScrollView>
            <TouchableOpacity style={styles.okBtn} onPress={() => setOpen(false)} activeOpacity={0.85}>
              <Text style={styles.okTxt}>Got it</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  btn: { justifyContent: 'center', alignItems: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  sheet: { width: '100%', maxWidth: 400, backgroundColor: '#fff', borderRadius: 20, padding: 20 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  title: { fontSize: 17, fontWeight: '800', color: '#16201b', flexShrink: 1 },
  body: { fontSize: 15, lineHeight: 22, color: '#3a4640' },
  okBtn: { marginTop: 18, height: 46, borderRadius: 12, backgroundColor: '#16201b', alignItems: 'center', justifyContent: 'center' },
  okTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

export default InfoTip;
