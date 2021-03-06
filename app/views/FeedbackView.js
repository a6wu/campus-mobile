import React, { Component } from 'react';
import {
	Text,
	View,
	InteractionManager,
	ActivityIndicator,
	TextInput,
	StyleSheet,
	Alert,
	TouchableWithoutFeedback,
	TouchableOpacity
} from 'react-native';
import { connect } from 'react-redux';
import Icon from 'react-native-vector-icons/FontAwesome';
import Device from 'react-native-device-info';
import { COLOR_MGREY } from '../styles/ColorConstants';
import { hideKeyboard, getCampusPrimary } from '../util/general';
import logger from '../util/logger';
import css from '../styles/css';
import AppSettings from '../AppSettings';

class FeedbackView extends Component {

	constructor(props) {
		super(props);

		this.state = {
			commentsText: '',
			nameText: '',
			emailText: '',
			commentsHeight: 0,
			loaded: false,
			submit: false,
		};
	}

	componentDidMount() {
		logger.ga('View Loaded: Feedback');

		InteractionManager.runAfterInteractions(() => {
			this.setState({ loaded: true });
		});
	}

	componentWillReceiveProps(nextProps) {
		// Clear search results when navigating away
		if (nextProps.scene.key !== this.props.scene.key) {
			this.setState({
				commentsText: '',
				nameText: '',
				emailText: '',
			});
		}
	}

	/**
	 * Called after state change
	 * @return bool whether the component should re-render.
	**/
	shouldComponentUpdate(nextProps, nextState) {
		return true;
	}

	_postFeedback() {
		if (this.state.commentsText !== '') {
			this.setState({ loaded: false });

			const formData = new FormData();
			formData.append('element_1', this.state.commentsText);
			formData.append('element_2', this.state.nameText);
			formData.append('element_3', this.state.emailText);
			formData.append(
				'element_4',
				'Device Manufacturer: ' + Device.getManufacturer() + '\n' +
				'Device Brand: ' + Device.getBrand() + '\n' +
				'Device Model: ' + Device.getModel() + '\n' +
				'Device ID: ' + Device.getDeviceId() + '\n' +
				'System Name: ' + Device.getSystemName() + '\n' +
				'System Version: ' + Device.getSystemVersion() + '\n' +
				'Bundle ID: ' + Device.getBundleId() + '\n' +
				'App Version: ' + Device.getVersion() + '\n' +
				'Build Number: ' + Device.getBuildNumber() + '\n' +
				'Device Name: ' + Device.getDeviceName() + '\n' +
				'User Agent: ' + Device.getUserAgent() + '\n' +
				'Device Locale: ' + Device.getDeviceLocale() + '\n' +
				'Device Country: ' + Device.getDeviceCountry() + '\n' +
				'Timezone: ' + Device.getTimezone()
			);
			formData.append('form_id','175631');
			formData.append('submit_form','1');
			formData.append('page_number','1');
			formData.append('submit_form','Submit');

			fetch('https://eforms.ucsd.edu/view.php?id=175631', {
				method: 'POST',
				body: formData
			})
			.then((response) => {
				// Clear fields and alert user
				Alert.alert(
					'Thank you!',
					'We will take your feedback into consideration as we continue developing and improving the app.',
				);

				this.setState({
					submit: true,
					commentsText: '',
					nameText: '',
					emailText: '',
					commentsHeight: 0,
					loaded: true
				});
				return response.json();
			})
			.then((responseJson) => {
				// logger.log(responseJson);
			})
			.catch((error) => {
				logger.log('Error submitting Feedback: ' + error);
			});
		}
		else {
			return;
		}
	}

	_renderLoadingView() {
		return (
			<View style={css.main_container}>
				<ActivityIndicator
					animating={true}
					style={styles.loading_icon}
					size="large"
				/>
			</View>
		);
	}

	_renderFormView() {
		return (
			<TouchableWithoutFeedback
				onPress={() => hideKeyboard()}
			>
				<View style={css.main_container}>
					<View style={styles.feedback_container}>
						<Text style={styles.feedback_label}>
							Help us make the {AppSettings.APP_NAME} app better.{'\n'}
							Submit your thoughts and suggestions.
						</Text>

						<View style={styles.feedback_text_container}>
							<TextInput
								ref={(ref) => { this._feedback = ref; }}
								multiline={true}
								blurOnSubmit={true}
								value={this.state.commentsText}
								onChange={(event) => {
									this.setState({
										commentsText: event.nativeEvent.text,
										commentsHeight: event.nativeEvent.contentSize.height,
									});
								}}
								placeholder="Tell us what you think*"
								underlineColorAndroid={'transparent'}
								style={[styles.feedback_text, { height: Math.max(50, this.state.commentsHeight) }]}
								returnKeyType={'done'}
								maxLength={500}
							/>
						</View>

						<View style={styles.text_container}>
							<TextInput
								ref={(ref) => { this._email = ref; }}
								value={this.state.emailText}
								onChangeText={(text) => this.setState({ emailText: text })}
								placeholder="Email"
								underlineColorAndroid={'transparent'}
								style={styles.feedback_text}
								returnKeyType={'done'}
								keyboardType={'email-address'}
								maxLength={100}
							/>
						</View>

						<TouchableOpacity underlayColor={'rgba(200,200,200,.1)'} onPress={() => this._postFeedback()}>
							<View style={styles.submit_container}>
								<Text style={styles.submit_text}>Submit</Text>
							</View>
						</TouchableOpacity>

					</View>
				</View>
			</TouchableWithoutFeedback>
		);
	}

	render() {
		// return this._renderSubmitView();
		if (!this.state.loaded) {
			return this._renderLoadingView();
		} else {
			return this._renderFormView();
		}
	}
}

const styles = StyleSheet.create({
	loading_icon: { flex: 1, alignItems: 'center', justifyContent: 'center' },
	feedback_container: { flexDirection: 'column', marginHorizontal: 8, marginTop: 8 },
	feedback_label: { flexWrap: 'wrap', fontSize: 18, paddingBottom: 16, lineHeight: 24 },
	feedback_text: { backgroundColor: 'white', flex:1, fontSize: 18, alignItems: 'center', padding: 8 },

	submit_container: { justifyContent: 'center', alignItems: 'center', backgroundColor: getCampusPrimary(), borderRadius: 3, padding: 10 },
	submit_text: { fontSize: 16, color: 'white' },

	feedback_text_container: { flexDirection: 'row', borderColor: COLOR_MGREY, borderBottomWidth: 1, marginBottom: 8, backgroundColor: 'white' },
	text_container: { height: 50, borderColor: COLOR_MGREY, borderBottomWidth: 1, marginBottom: 8 },
});

const mapStateToProps = (state, props) => (
	{
		scene: state.routes.scene
	}
);

module.exports = connect(mapStateToProps)(FeedbackView);
