#ifndef SIGNAL_GENERATOR_H
#define SIGNAL_GENERATOR_H

#include <Arduino.h>
#include "HighSpeedPWMDAC.h"

class SignalGenerator {
public:
  enum Wave { SINE, SQUARE, TRIANGLE, RAMP };

  // dac: reference to the HighSpeedPWMDAC instance (pin already set there)
  // frequency: initial frequency in Hz
  // sampleRate: how many waveform samples per second to compute (default 2000)
  SignalGenerator(HighSpeedPWMDAC &dac, float frequency = 1.0f, unsigned long sampleRate = 2000);

  void begin();
  void setFrequency(float freqHz);
  void setWaveform(Wave w);
  void setSampleRate(unsigned long sr);
  void setEnabled(bool en);

  // Call frequently (e.g. inside loop()). The class uses micros() to
  // advance phase and will update the DAC output when required.
  void update();

private:
  HighSpeedPWMDAC &_dac;
  float _frequency; // Hz
  unsigned long _sampleRate; // samples per second (advisable >= 1000)
  bool _enabled;
  float _phase; // radians
  unsigned long _lastMicros;
  Wave _wave;

  void outputSample(float phase);
};

#endif // SIGNAL_GENERATOR_H
