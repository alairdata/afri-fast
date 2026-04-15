import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, Modal, Platform } from 'react-native';
import FastingQuizPage from './FastingQuizPage';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const PlanSelectionPage = ({ show, onClose, selectedPlan, isFasting, onSelectPlan }) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingPlan, setPendingPlan] = useState(null);
  const [showQuiz, setShowQuiz] = useState(false);

  const selectPlan = (plan) => {
    if (isFasting && plan.id !== selectedPlan) {
      setPendingPlan(plan);
      setShowConfirm(true);
    } else {
      onSelectPlan(plan);
      onClose();
    }
  };

  const confirmChange = () => {
    if (pendingPlan) {
      onSelectPlan(pendingPlan);
      setPendingPlan(null);
    }
    setShowConfirm(false);
    onClose();
  };

  const cancelChange = () => {
    setPendingPlan(null);
    setShowConfirm(false);
  };

  if (!show) return null;

  return (
    <View style={styles.planPageOverlay}>
      <View style={styles.planPage}>
        <View style={styles.planPageHeader}>
          <View>
            <Text style={styles.planPageTitle}>Fasting times</Text>
            <Text style={styles.planPageHeaderSub}>Choose your preferred fasting time</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={{ color: '#666', fontSize: 18 }}>{'✕'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.plansList} showsVerticalScrollIndicator={false}>
          {/* Quiz CTA */}
          <TouchableOpacity style={styles.quizCta} onPress={() => setShowQuiz(true)}>
            <View style={styles.quizCtaLeft}>
              <Ionicons name="sparkles" size={20} color="#059669" />
              <View>
                <Text style={styles.quizCtaTitle}>Not sure which plan?</Text>
                <Text style={styles.quizCtaSub}>Take a 2-min quiz to find your perfect fit</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#059669" />
          </TouchableOpacity>

          {/* Beginner Section */}
          <View style={styles.planSection}>
            <View style={[styles.sectionHeader, { backgroundColor: '#ECFDF5' }]}>
              <Text style={styles.sectionLabel}>Beginner</Text>
              <Text style={styles.sectionSub}>Perfect for starting your fasting journey</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.planCardsScroll} contentContainerStyle={styles.planCardsScrollContent}>
              <TouchableOpacity
                style={[
                  styles.planCardNew,
                  styles.planCardGreen,
                  selectedPlan === '10:14' ? styles.planCardSelectedNew : null,
                ]}
                onPress={() => selectPlan({ id: '10:14', fastHours: 10 })}
              >
                <Text style={styles.planRatio}>10:14</Text>
                <Text style={styles.planCardText}>Fast for 10 hours, eat within a 14 hour window</Text>
                {selectedPlan === '10:14' && <View style={styles.selectedCheck}><Text style={styles.selectedCheckText}>{'✓'}</Text></View>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.planCardNew,
                  styles.planCardGreen,
                  selectedPlan === '14:10' ? styles.planCardSelectedNew : null,
                ]}
                onPress={() => selectPlan({ id: '14:10', fastHours: 14 })}
              >
                <Text style={styles.planRatio}>14:10</Text>
                <Text style={styles.planCardText}>14 hours of fasting with a 10 hour eating period</Text>
                {selectedPlan === '14:10' && <View style={styles.selectedCheck}><Text style={styles.selectedCheckText}>{'✓'}</Text></View>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.planCardNew,
                  styles.planCardGreen,
                  selectedPlan === '15:9' ? styles.planCardSelectedNew : null,
                ]}
                onPress={() => selectPlan({ id: '15:9', fastHours: 15 })}
              >
                <Text style={styles.planRatio}>15:9</Text>
                <Text style={styles.planCardText}>15 hour fast paired with 9 hours to enjoy meals</Text>
                {selectedPlan === '15:9' && <View style={styles.selectedCheck}><Text style={styles.selectedCheckText}>{'✓'}</Text></View>}
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Regular Section */}
          <View style={styles.planSection}>
            <View style={[styles.sectionHeader, { backgroundColor: '#FFFBEB' }]}>
              <Text style={styles.sectionLabel}>Regular</Text>
              <Text style={styles.sectionSub}>Unlock the full benefits of intermittent fasting</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.planCardsScroll} contentContainerStyle={styles.planCardsScrollContent}>
              <TouchableOpacity
                style={[
                  styles.planCardNew,
                  styles.planCardYellow,
                  selectedPlan === '16:8' ? styles.planCardSelectedNew : null,
                ]}
                onPress={() => selectPlan({ id: '16:8', fastHours: 16 })}
              >
                <Text style={styles.planRatio}>16:8</Text>
                <Text style={styles.planCardText}>The classic 16 hour fast with 8 hour eating window</Text>
                {selectedPlan === '16:8' && <View style={styles.selectedCheck}><Text style={styles.selectedCheckText}>{'✓'}</Text></View>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.planCardNew,
                  styles.planCardYellow,
                  selectedPlan === '17:7' ? styles.planCardSelectedNew : null,
                ]}
                onPress={() => selectPlan({ id: '17:7', fastHours: 17 })}
              >
                <Text style={styles.planRatio}>17:7</Text>
                <Text style={styles.planCardText}>Go a bit longer with 17 hours fasting, 7 hours eating</Text>
                {selectedPlan === '17:7' && <View style={styles.selectedCheck}><Text style={styles.selectedCheckText}>{'✓'}</Text></View>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.planCardNew,
                  styles.planCardYellow,
                  selectedPlan === '18:6' ? styles.planCardSelectedNew : null,
                ]}
                onPress={() => selectPlan({ id: '18:6', fastHours: 18 })}
              >
                <Text style={styles.planRatio}>18:6</Text>
                <Text style={styles.planCardText}>18 hours without food, 6 hour window for meals</Text>
                {selectedPlan === '18:6' && <View style={styles.selectedCheck}><Text style={styles.selectedCheckText}>{'✓'}</Text></View>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.planCardNew,
                  styles.planCardYellow,
                  selectedPlan === '19:5' ? styles.planCardSelectedNew : null,
                ]}
                onPress={() => selectPlan({ id: '19:5', fastHours: 19 })}
              >
                <Text style={styles.planRatio}>19:5</Text>
                <Text style={styles.planCardText}>Push further with 19 hours fasting, 5 hour eating</Text>
                {selectedPlan === '19:5' && <View style={styles.selectedCheck}><Text style={styles.selectedCheckText}>{'✓'}</Text></View>}
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Expert Section */}
          <View style={styles.planSection}>
            <View style={[styles.sectionHeader, { backgroundColor: '#FFF7ED' }]}>
              <Text style={styles.sectionLabel}>Expert</Text>
              <Text style={styles.sectionSub}>For experienced fasters ready to level up</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.planCardsScroll} contentContainerStyle={styles.planCardsScrollContent}>
              <TouchableOpacity
                style={[
                  styles.planCardNew,
                  styles.planCardOrange,
                  selectedPlan === '21:3' ? styles.planCardSelectedNew : null,
                ]}
                onPress={() => selectPlan({ id: '21:3', fastHours: 21 })}
              >
                <Text style={styles.planRatio}>21:3</Text>
                <Text style={styles.planCardText}>Intense 21 hour fast with a tight 3 hour eating window</Text>
                {selectedPlan === '21:3' && <View style={styles.selectedCheck}><Text style={styles.selectedCheckText}>{'✓'}</Text></View>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.planCardNew,
                  styles.planCardOrange,
                  selectedPlan === '22:2' ? styles.planCardSelectedNew : null,
                ]}
                onPress={() => selectPlan({ id: '22:2', fastHours: 22 })}
              >
                <Text style={styles.planRatio}>22:2</Text>
                <Text style={styles.planCardText}>22 hours fasting, just 2 hours to eat your meals</Text>
                {selectedPlan === '22:2' && <View style={styles.selectedCheck}><Text style={styles.selectedCheckText}>{'✓'}</Text></View>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.planCardNew,
                  styles.planCardOrange,
                  selectedPlan === '23:1' ? styles.planCardSelectedNew : null,
                ]}
                onPress={() => selectPlan({ id: '23:1', fastHours: 23 })}
              >
                <Text style={styles.planRatio}>23:1</Text>
                <Text style={styles.planCardText}>One meal a day - 23 hours fasting, 1 hour to eat</Text>
                {selectedPlan === '23:1' && <View style={styles.selectedCheck}><Text style={styles.selectedCheckText}>{'✓'}</Text></View>}
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Weekly Schedules Section */}
          <View style={styles.planSection}>
            <View style={[styles.sectionHeader, { backgroundColor: '#EFF6FF' }]}>
              <Text style={styles.sectionLabel}>Weekly schedules</Text>
              <Text style={styles.sectionSub}>Flexible plans that work around your week</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.planCardsScroll} contentContainerStyle={styles.planCardsScrollContent}>
              <TouchableOpacity
                style={[styles.planCardNew, styles.planCardBlue]}
                onPress={() => {/* Show paywall */}}
              >
                <View style={styles.planCardTop}>
                  <Text style={styles.planRatio}>4:3</Text>
                  <View style={styles.plusBadge}><Text style={styles.plusBadgeText}>PLUS</Text></View>
                </View>
                <Text style={styles.planCardText}>Eat normally for 4 days, fast for 3 days each week</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.planCardNew, styles.planCardBlue]}
                onPress={() => {/* Show paywall */}}
              >
                <View style={styles.planCardTop}>
                  <Text style={styles.planRatio}>5:2</Text>
                  <View style={styles.plusBadge}><Text style={styles.plusBadgeText}>PLUS</Text></View>
                </View>
                <Text style={styles.planCardText}>5 regular eating days with 2 fasting days weekly</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.planCardNew, styles.planCardBlue]}
                onPress={() => {/* Show paywall */}}
              >
                <View style={styles.planCardTop}>
                  <Text style={styles.planRatio}>6:1</Text>
                  <View style={styles.plusBadge}><Text style={styles.plusBadgeText}>PLUS</Text></View>
                </View>
                <Text style={styles.planCardText}>Eat for 6 days, dedicate 1 day to fasting</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Custom Schedule Section */}
          <View style={styles.planSection}>
            <View style={[styles.sectionHeader, { backgroundColor: '#F5F3FF' }]}>
              <Text style={styles.sectionLabel}>Custom schedule</Text>
              <Text style={styles.sectionSub}>Design a plan that fits your unique lifestyle</Text>
            </View>
            <View style={styles.planCardsWrapper}>
              <TouchableOpacity
                style={[styles.planCardNew, styles.planCardPurple, { width: '100%' }]}
                onPress={() => {/* Show paywall */}}
              >
                <View style={styles.planCardTop}>
                  <Text style={styles.planRatio}>Custom</Text>
                  <View style={styles.plusBadge}><Text style={styles.plusBadgeText}>PLUS</Text></View>
                </View>
                <Text style={styles.planCardText}>Build your own fasting schedule tailored to your goals</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Long Fasts Section */}
          <View style={styles.planSection}>
            <View style={[styles.sectionHeader, { backgroundColor: '#FDF2F8' }]}>
              <Text style={styles.sectionLabel}>Long fasts</Text>
              <Text style={styles.sectionSub}>Take on a bigger challenge when you're ready</Text>
            </View>
            <View style={styles.planCardsWrapper}>
              <TouchableOpacity
                style={[styles.planCardNew, styles.planCardPink, { width: '100%' }]}
                onPress={() => {/* Show paywall */}}
              >
                <View style={styles.planCardTop}>
                  <Text style={styles.planRatio}>Long</Text>
                  <View style={styles.plusBadge}><Text style={styles.plusBadgeText}>PLUS</Text></View>
                </View>
                <Text style={styles.planCardText}>Extended fasting beyond 24 hours for special occasions</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>

      {/* Fasting Quiz */}
      <FastingQuizPage
        show={showQuiz}
        onClose={() => setShowQuiz(false)}
        onSelectPlan={(plan) => {
          setShowQuiz(false);
          selectPlan(plan);
        }}
      />

      {/* Confirmation modal - renders on top of this page */}
      <Modal visible={showConfirm} transparent animationType="fade">
        <View style={styles.alertOverlay}>
          <View style={styles.alertCard}>
            {/* Top accent bar */}
            <View style={styles.alertAccentBar} />

            <View style={styles.alertIconCircle}>
              <Ionicons name="swap-horizontal" size={28} color="#059669" />
            </View>

            {/* Plan switch visual */}
            <View style={styles.alertPlanSwitch}>
              <View style={styles.alertPlanBubble}>
                <Text style={styles.alertPlanBubbleText}>{selectedPlan}</Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color="#059669" />
              <View style={[styles.alertPlanBubble, styles.alertPlanBubbleNew]}>
                <Text style={[styles.alertPlanBubbleText, styles.alertPlanBubbleNewText]}>{pendingPlan?.id || ''}</Text>
              </View>
            </View>

            <Text style={styles.alertTitle}>Switch your fast?</Text>
            <Text style={styles.alertMessage}>
              Your current {selectedPlan} timer will continue, but your target end time will adjust to match the new plan.
            </Text>

            <View style={styles.alertButtons}>
              <TouchableOpacity style={styles.alertCancelBtn} onPress={cancelChange}>
                <Text style={styles.alertCancelText}>No, keep it</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.alertConfirmBtn} onPress={confirmChange}>
                <Text style={styles.alertConfirmText}>Switch</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  planPageOverlay: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FAFBFF',
    zIndex: 10000,
  },
  planPage: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    height: SCREEN_HEIGHT,
    flexDirection: 'column',
    flex: 1,
  },
  planPageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  planPageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F1F1F',
    letterSpacing: -0.5,
  },
  planPageHeaderSub: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  plansList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  planSection: {
    marginTop: 20,
  },
  sectionHeader: {
    padding: 14,
    paddingHorizontal: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  sectionSub: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  planCardsScroll: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  planCardsScrollContent: {
    padding: 12,
  },
  planCardsWrapper: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 12,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  planCardNew: {
    flexShrink: 0,
    width: 140,
    padding: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
    marginRight: 10,
  },
  planCardGreen: {
    backgroundColor: '#ECFDF5',
  },
  planCardYellow: {
    backgroundColor: '#FFFBEB',
  },
  planCardOrange: {
    backgroundColor: '#FFF7ED',
  },
  planCardBlue: {
    backgroundColor: '#EFF6FF',
  },
  planCardPurple: {
    backgroundColor: '#F5F3FF',
  },
  planCardPink: {
    backgroundColor: '#FDF2F8',
  },
  planCardSelectedNew: {
    borderColor: '#059669',
    shadowColor: 'rgba(5, 150, 105, 1)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  planCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  planRatio: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  planCardText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16.8,
  },
  selectedCheck: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCheckText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  plusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#059669',
  },
  plusBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  quizCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ECFDF5',
    padding: 16,
    borderRadius: 16,
    marginTop: 12,
    marginBottom: 8,
  },
  quizCtaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  quizCtaTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#059669',
  },
  quizCtaSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  alertCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 28,
    paddingBottom: 24,
    alignItems: 'center',
    overflow: 'hidden',
  },
  alertAccentBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#059669',
  },
  alertIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  alertPlanSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  alertPlanBubble: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
  },
  alertPlanBubbleText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#999',
  },
  alertPlanBubbleNew: {
    backgroundColor: '#059669',
  },
  alertPlanBubbleNewText: {
    color: '#fff',
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1F1F1F',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  alertMessage: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
    paddingHorizontal: 24,
  },
  alertButtons: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 24,
    width: '100%',
  },
  alertCancelBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  alertCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
  },
  alertConfirmBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 16,
    backgroundColor: '#059669',
    alignItems: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  alertConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});

export default PlanSelectionPage;
