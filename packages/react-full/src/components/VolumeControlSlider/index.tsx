import type React from "react";
import { useEffect, useRef } from "react";
import { BouncingSlider, type SliderProps } from "../BouncingSlider";
import IconSpeaker from "./icon_speaker.svg?react";
import IconSpeaker3 from "./icon_speaker_3.svg?react";
import styles from "./index.module.css";

export const VolumeControl: React.FC<SliderProps> = (props) => {
	const lastValueRef = useRef(props.value);
	const minSpeakerRef = useRef<SVGSVGElement>(null);
	const maxSpeakerRef = useRef<SVGSVGElement>(null);

	useEffect(() => {
		if (lastValueRef.current !== props.value) {
			lastValueRef.current = props.value;
			if (props.value <= props.min && minSpeakerRef.current) {
				minSpeakerRef.current.classList.remove(styles.speakerAnimate);
				requestAnimationFrame(() => {
					minSpeakerRef.current?.classList?.add(styles.speakerAnimate);
				});
			} else if (props.value >= props.max && maxSpeakerRef.current) {
				maxSpeakerRef.current.classList.remove(styles.speakerAnimate);
				requestAnimationFrame(() => {
					maxSpeakerRef.current?.classList?.add(styles.speakerAnimate);
				});
			}
		}
	}, [props.value, props.min, props.max]);

	return (
		<BouncingSlider
			className={styles.volumeControl}
			beforeIcon={<IconSpeaker ref={minSpeakerRef} color="#FFFFFF" />}
			afterIcon={<IconSpeaker3 ref={maxSpeakerRef} color="#FFFFFF" />}
			changeOnDrag={true}
			{...props}
		/>
	);
};
